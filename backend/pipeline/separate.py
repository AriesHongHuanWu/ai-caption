"""人聲分離模組（Demucs v4，底層 API）。

提供 :func:`separate_vocals`，使用 Demucs htdemucs 模型把伴奏與人聲分離，
回傳「人聲」.wav 的路徑，讓後續 Whisper / 對齊步驟在乾淨人聲上運作，提高辨識準確度。

實作備註
--------
PyPI 的 demucs 4.0.1 **沒有** `demucs.api` 便利模組,因此改用底層 API:
  demucs.pretrained.get_model → demucs.apply.apply_model → demucs.audio.save_audio。
mp3 等格式的解碼不依賴系統 ffmpeg:優先用 torchaudio,失敗則用 PyAV
(faster-whisper 的相依,已內含 ffmpeg 函式庫)解碼,最後退回 soundfile。

設計原則:優雅降級。任何相依缺失 / 模型下載失敗 / 分離失敗,**絕不**讓伺服器崩潰,
而是記錄警告並回傳「原始」音檔路徑,讓 pipeline 仍可在原始混音上繼續辨識。

對外契約:
  - is_available() -> bool
  - separate_vocals(audio_path, out_dir, model_name="htdemucs", device="cuda", shifts=0, progress=None) -> str
  - progress(stage, pct, msg):本步驟內部 0..100,由上層 pipeline 映射到 0-40 進度帶。

支援的 model_name
-----------------
  - "htdemucs"(預設,快、品質好,8GB VRAM 友善)
  - "htdemucs_ft"(微調版 bag-of-4,人聲略乾淨但 ~4× 慢、8GB 可能在長曲 OOM)
get_model 回傳的可能是單一模型或 BagOfModels(htdemucs_ft);兩者都暴露
.samplerate / .audio_channels / .sources,apply_model 也都支援,故下游無需特判。
shifts>0 啟用測試時擴增(更乾淨但更慢),僅建議在「最佳品質」模式開啟。
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Callable, Optional

logger = logging.getLogger("autolyrics.separate")

_STAGE = "separate"
ProgressFn = Callable[[str, float, str], None]

# --------------------------------------------------------------------------- #
# 可選相依偵測（底層 demucs API）
# --------------------------------------------------------------------------- #
_DEMUCS_AVAILABLE = False
_IMPORT_ERROR: Optional[str] = None

try:  # pragma: no cover - 取決於執行環境
    import torch  # type: ignore
    import torchaudio  # type: ignore
    from demucs.apply import apply_model  # type: ignore
    from demucs.pretrained import get_model  # type: ignore

    try:
        from demucs.audio import save_audio as _demucs_save_audio  # type: ignore
    except Exception:  # 極少數版本路徑不同 → 退回 torchaudio.save
        _demucs_save_audio = None  # type: ignore

    _DEMUCS_AVAILABLE = True
except Exception as exc:
    torch = None  # type: ignore
    torchaudio = None  # type: ignore
    apply_model = None  # type: ignore
    get_model = None  # type: ignore
    _demucs_save_audio = None  # type: ignore
    _IMPORT_ERROR = f"{type(exc).__name__}: {exc}"
    logger.info("Demucs 不可用，將跳過人聲分離（%s）", _IMPORT_ERROR)

# 模型快取(權重不小,避免每個 job 重載)
_MODEL_CACHE: dict[str, Any] = {}
_MODEL_LOCK = threading.Lock()
# 重型推論一次只能跑一個:共用快取模型 + 單一(8GB)GPU,並行會 race model.to() 或爆 VRAM。
_INFER_SEM = threading.BoundedSemaphore(1)


def _emit(progress: Optional[ProgressFn], pct: float, msg: str) -> None:
    if progress is None:
        return
    try:
        progress(_STAGE, float(pct), msg)
    except Exception:  # pragma: no cover
        logger.debug("progress 回呼丟出例外，已忽略", exc_info=True)


def is_available() -> bool:
    """回傳 Demucs 人聲分離是否可用(僅檢查相依匯入)。"""
    return _DEMUCS_AVAILABLE


def _resolve_device(device: str) -> str:
    dev = (device or "cpu").strip().lower()
    if dev.startswith("cuda"):
        try:
            if torch is not None and torch.cuda.is_available():  # type: ignore[union-attr]
                return "cuda"
        except Exception:  # pragma: no cover
            logger.debug("torch.cuda 探測失敗，退回 CPU", exc_info=True)
        logger.warning("要求 device=cuda 但 CUDA 不可用，退回 CPU 進行人聲分離")
        return "cpu"
    return dev


def _get_model(model_name: str) -> Any:
    cached = _MODEL_CACHE.get(model_name)
    if cached is not None:
        return cached
    with _MODEL_LOCK:
        cached = _MODEL_CACHE.get(model_name)
        if cached is not None:
            return cached
        logger.info("載入 Demucs 模型 %s（首次會下載權重）", model_name)
        model = get_model(model_name)  # type: ignore[misc]
        model.eval()
        _MODEL_CACHE[model_name] = model
        return model


def _load_audio_tensor(path: str, samplerate: int, channels: int) -> Any:
    """把音檔解碼成 (channels, frames) 的 float32 Tensor,取樣率= samplerate。

    解碼後備鏈:torchaudio → PyAV(faster-whisper 相依,內含 ffmpeg)→ soundfile。
    任一成功即回傳;全失敗則拋例外(由呼叫端降級)。
    """
    last_err: Optional[Exception] = None

    # 1) torchaudio
    try:
        wav, sr = torchaudio.load(path)  # type: ignore[union-attr]  # (ch, n)
        wav = _fit(wav, sr, samplerate, channels)
        return wav
    except Exception as exc:
        last_err = exc
        logger.debug("torchaudio.load 失敗,改用 PyAV(%s)", exc)

    # 2) PyAV(透過 faster-whisper 的 decode_audio,內含 ffmpeg,免系統安裝)
    try:
        from faster_whisper.audio import decode_audio  # type: ignore

        if channels == 2:
            left, right = decode_audio(path, sampling_rate=samplerate, split_stereo=True)
            import numpy as np  # type: ignore

            arr = np.stack([left, right], axis=0)
        else:
            mono = decode_audio(path, sampling_rate=samplerate)
            import numpy as np  # type: ignore

            arr = mono[None, :]
        return torch.from_numpy(arr).float()  # type: ignore[union-attr]
    except Exception as exc:
        last_err = exc
        logger.debug("PyAV decode 失敗,改用 soundfile(%s)", exc)

    # 3) soundfile(主要支援 wav/flac/ogg)
    try:
        import soundfile as sf  # type: ignore

        data, sr = sf.read(path, always_2d=True)  # (n, ch)
        wav = torch.from_numpy(data.T).float()  # type: ignore[union-attr]
        wav = _fit(wav, sr, samplerate, channels)
        return wav
    except Exception as exc:
        last_err = exc

    raise RuntimeError(f"無法解碼音檔:{last_err}")


def _fit(wav: Any, sr: int, target_sr: int, channels: int) -> Any:
    """調整聲道數與取樣率。"""
    if wav.dim() == 1:
        wav = wav.unsqueeze(0)
    # 聲道
    cur = wav.shape[0]
    if cur < channels:  # mono → stereo
        wav = wav.repeat(channels, 1)
    elif cur > channels:  # 多聲道 → 取前 channels(或平均成 mono)
        wav = wav.mean(0, keepdim=True) if channels == 1 else wav[:channels]
    # 取樣率
    if sr != target_sr:
        wav = torchaudio.functional.resample(wav, sr, target_sr)  # type: ignore[union-attr]
    return wav.float()


def separate_vocals(
    audio_path: str,
    out_dir: str,
    model_name: str = "htdemucs",
    device: str = "cuda",
    shifts: int = 0,
    progress: Optional[ProgressFn] = None,
) -> str:
    """以 Demucs 分離人聲,回傳人聲 .wav 路徑;任何失敗都優雅降級回原始 audio_path。

    model_name 接受 "htdemucs" 或 "htdemucs_ft"(微調 bag,較慢較乾淨)。
    shifts>0 啟用測試時擴增(更乾淨但更慢);僅建議「最佳品質」模式使用。
    """
    if not audio_path or not os.path.isfile(audio_path):
        logger.warning("人聲分離輸入檔不存在:%r，直接回傳原始路徑", audio_path)
        _emit(progress, 100.0, "找不到音檔，跳過人聲分離")
        return audio_path

    if not _DEMUCS_AVAILABLE:
        logger.info("Demucs 不可用，跳過人聲分離,使用原始混音")
        _emit(progress, 100.0, "未安裝 Demucs，跳過人聲分離")
        return audio_path

    try:
        _emit(progress, 1.0, "載入 Demucs 模型…")
        dev = _resolve_device(device)
        try:
            os.makedirs(out_dir, exist_ok=True)
        except Exception:  # pragma: no cover
            logger.warning("無法建立輸出資料夾 %r", out_dir, exc_info=True)

        # ---- 載入模型 ---------------------------------------------------- #
        # 未知 model_name 時退回預設 htdemucs(避免 get_model 直接拋而中斷)。
        req_model = (model_name or "htdemucs").strip() or "htdemucs"
        try:
            model = _get_model(req_model)
            model.to(dev)
        except Exception as exc:
            logger.warning("Demucs 模型載入失敗(model=%s):%s", req_model, exc, exc_info=True)
            if req_model != "htdemucs":
                logger.info("改試預設模型 htdemucs")
                try:
                    model = _get_model("htdemucs")
                    model.to(dev)
                except Exception as exc2:
                    logger.warning("預設模型 htdemucs 也載入失敗:%s;改用原始音檔",
                                   exc2, exc_info=True)
                    _emit(progress, 100.0, "Demucs 載入失敗，跳過人聲分離")
                    return audio_path
            else:
                _emit(progress, 100.0, "Demucs 載入失敗，跳過人聲分離")
                return audio_path

        sr = int(model.samplerate)
        ch = int(model.audio_channels)

        # ---- 解碼音檔 ---------------------------------------------------- #
        _emit(progress, 8.0, "讀取音檔…")
        wav = _load_audio_tensor(audio_path, sr, ch)

        # demucs 慣例:用整段 ref 的 mean/std 正規化,分離後還原
        ref = wav.mean(0)
        std = ref.std() + 1e-8
        wav_n = (wav - ref.mean()) / std

        _emit(progress, 15.0, f"以 {dev.upper()} 分離人聲中…")

        # ---- 執行分離 ---------------------------------------------------- #
        try:
            with torch.no_grad():  # type: ignore[union-attr]
                sources = apply_model(  # type: ignore[misc]
                    model, wav_n[None], device=dev, split=True, overlap=0.25,
                    shifts=max(0, int(shifts)), progress=False,
                )[0]
            sources = sources * std + ref.mean()
        except Exception as exc:
            logger.warning("Demucs 分離過程失敗:%s;改用原始音檔", exc, exc_info=True)
            _emit(progress, 100.0, "人聲分離失敗，使用原始音檔")
            return audio_path

        # ---- 取出 vocals stem ------------------------------------------- #
        try:
            vocals_idx = list(model.sources).index("vocals")
        except ValueError:
            logger.warning("Demucs 模型無 'vocals' stem(sources=%s);改用原始音檔",
                           list(model.sources))
            _emit(progress, 100.0, "找不到人聲音軌，使用原始音檔")
            return audio_path
        vocals = sources[vocals_idx].cpu()  # (ch, n)

        _emit(progress, 85.0, "輸出人聲音軌…")

        # ---- 寫出 wav ---------------------------------------------------- #
        # 用 soundfile(libsndfile)直接寫 wav,**刻意避開 torchaudio.save** ——
        # torchaudio 2.11 的 save 改走 torchcodec(預設未安裝),demucs.save_audio 也會中招。
        base = os.path.splitext(os.path.basename(audio_path))[0]
        out_wav = os.path.join(out_dir, f"{base}_vocals.wav")
        try:
            import soundfile as sf  # type: ignore

            data = vocals.clamp(-1.0, 1.0).numpy().T  # (ch, n) -> (n, ch)
            sf.write(out_wav, data, sr, subtype="PCM_16")
        except Exception as exc:
            logger.warning("寫出人聲 wav 失敗(%s):%s;改用原始音檔", out_wav, exc, exc_info=True)
            _emit(progress, 100.0, "寫出人聲檔失敗，使用原始音檔")
            return audio_path

        if not os.path.isfile(out_wav) or os.path.getsize(out_wav) == 0:
            logger.warning("人聲 wav 輸出無效(%s);改用原始音檔", out_wav)
            _emit(progress, 100.0, "人聲檔無效，使用原始音檔")
            return audio_path

        logger.info("人聲分離完成:%s", out_wav)
        _emit(progress, 100.0, "人聲分離完成")
        return os.path.abspath(out_wav)

    except Exception as exc:  # 最外層保險
        logger.warning("人聲分離發生未預期錯誤:%s;改用原始音檔", exc, exc_info=True)
        _emit(progress, 100.0, "人聲分離發生錯誤，使用原始音檔")
        return audio_path


def separate_stems(
    audio_path: str,
    model_name: str = "htdemucs",
    device: str = "cuda",
    shifts: int = 0,
    progress: Optional[ProgressFn] = None,
) -> Optional[dict]:
    """分離成 4 軌(drums / bass / other / vocals),供 AI 分軌母帶用。
    回 {"sr": int, "stems": {name: (n, ch) float32}};任何失敗 → None(呼叫端降級為不分軌)。
    VRAM 不足或 CUDA OOM 時自動退回 CPU;結束清快取。"""
    if not audio_path or not os.path.isfile(audio_path) or not _DEMUCS_AVAILABLE:
        return None
    import numpy as np  # type: ignore
    try:
        dev = _resolve_device(device)
        req_model = (model_name or "htdemucs").strip() or "htdemucs"
        try:
            model = _get_model(req_model)
        except Exception:
            model = _get_model("htdemucs")
        sr = int(model.samplerate)
        ch = int(model.audio_channels)
        _emit(progress, 6.0, "讀取音檔…")
        wav = _load_audio_tensor(audio_path, sr, ch)
        ref = wav.mean(0)
        std = ref.std() + 1e-8
        wav_n = (wav - ref.mean()) / std

        # VRAM 預檢:粗估工作集(樣本數×~600B/sample,含 split buffers)> 可用顯存 → 直接走 CPU,
        # 避免「先試 GPU → OOM → 退 CPU」白跑一趟。
        if dev == "cuda":
            try:
                free, _total = torch.cuda.mem_get_info()  # type: ignore[union-attr]
                need = int(wav_n.shape[-1]) * 600
                if free < need * 1.5:
                    logger.info("可用 VRAM 不足(free=%dMB,估需~%dMB)→ 直接用 CPU 分軌", free >> 20, (need * 1.5) >> 20)
                    dev = "cpu"
            except Exception:
                logger.debug("VRAM 預檢失敗(忽略)", exc_info=True)

        # 進度心跳:apply_model 內部不回報(progress=False),用背景執行緒讓進度條在這 1–3 分鐘內前進。
        _hb_stop = threading.Event()

        def _heartbeat():
            p = 14.0
            while not _hb_stop.wait(3.0):
                p = min(95.0, p + 4.0)
                _emit(progress, p, "分離 4 軌中… · Separating")

        def _run(on_dev: str):
            model.to(on_dev)
            with torch.no_grad():  # type: ignore[union-attr]
                out = apply_model(  # type: ignore[misc]
                    model, wav_n[None], device=on_dev, split=True, overlap=0.25,
                    shifts=max(0, int(shifts)), progress=False)[0]
            return out * std + ref.mean()

        _emit(progress, 12.0, f"以 {dev.upper()} 分離 4 軌中…")
        hb = threading.Thread(target=_heartbeat, daemon=True)
        hb.start()
        # 一次只跑一個重型推論(共用模型 + 單 GPU),序列化避免 race / 並行 OOM
        with _INFER_SEM:
            try:
                sources = _run(dev)
            except Exception as exc:  # CUDA OOM 等 → 退 CPU
                if dev != "cpu":
                    logger.warning("GPU 分軌失敗(%s)→ 退回 CPU(較慢)", exc)
                    try:
                        torch.cuda.empty_cache()  # type: ignore[union-attr]
                    except Exception:
                        pass
                    _emit(progress, 14.0, "GPU 不足,改用 CPU 分軌(較慢)…")
                    sources = _run("cpu")
                else:
                    _hb_stop.set()
                    raise
        _hb_stop.set()

        stems: dict = {}
        for i, name in enumerate(model.sources):
            arr = sources[i].cpu().numpy().T.astype(np.float32)  # (ch, n) -> (n, ch)
            stems[str(name)] = np.ascontiguousarray(arr)
        try:
            if dev == "cuda":
                torch.cuda.empty_cache()  # type: ignore[union-attr]
        except Exception:
            pass
        _emit(progress, 100.0, "分軌完成")
        logger.info("4 軌分離完成:%s", list(stems.keys()))
        return {"sr": sr, "stems": stems}
    except Exception as exc:
        logger.warning("4 軌分離失敗:%s;將不分軌", exc, exc_info=True)
        try:
            if torch is not None:
                torch.cuda.empty_cache()  # type: ignore[union-attr]
        except Exception:
            pass
        return None
