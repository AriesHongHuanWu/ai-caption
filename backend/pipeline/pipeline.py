"""AutoLyrics 辨識管線總協調器(orchestrator)。

`run()` 串接四個子步驟,並按照 API_CONTRACT.md 的 `Result` 形狀回傳:

    1. 解析裝置(device auto -> cuda / cpu)
    2. (可選)Demucs 人聲分離
    3. 依 mode 派工:align(完整歌詞強制對齊)/ biasing(提示偏置辨識)/ auto(純辨識)
    4. 指派 segment id、計算 durationSec,組裝最終 Result

設計原則:任何重型相依(torch / soundfile / 子模組)缺席或失敗都不可讓整個
伺服器崩潰 —— 一律以 try/except 包覆並優雅降級。`progress(stage, pct, msg)`
會被轉發到各子步驟,並切成合理的 pct 分段(分離 0-40、辨識 40-95、收尾 95-100)。
"""

from __future__ import annotations

import logging
import math
from typing import Any, Callable, Optional

from . import config
from . import separate as _separate
from . import transcribe as _transcribe
from . import align as _align

logger = logging.getLogger("autolyrics.pipeline")

# progress callback 型別:progress(stage: str, pct: float, msg: str) -> None
ProgressFn = Callable[[str, float, str], None]


# ---------------------------------------------------------------------------
# 內部工具
# ---------------------------------------------------------------------------
def _noop_progress(stage: str, pct: float, msg: str) -> None:
    """預設的空 progress callback。"""
    return None


class _MonotonicProgress:
    """包裝對外 progress callback,確保回報的 pct 永不倒退。

    子步驟各自從 0 開始回報、加上各階段的開場訊息,會在邊界產生 1~2 pct 的
    視覺回跳。這個包裝把每次 pct clamp 到「目前已達最大值」之上,讓三段式
    stepper 的全域進度條始終單調遞增。stage / msg 仍原樣傳遞。
    """

    def __init__(self, inner: Optional[ProgressFn]) -> None:
        self._inner = inner
        self._max = 0.0

    def __call__(self, stage: str, pct: float, msg: str) -> None:
        if self._inner is None:
            return
        try:
            p = float(pct)
        except (TypeError, ValueError):
            p = self._max
        if p < self._max:
            p = self._max
        else:
            self._max = p
        try:
            self._inner(stage, p, msg)
        except Exception:  # pragma: no cover - 防禦性
            logger.debug("progress callback raised; ignored", exc_info=True)


def _safe_progress(progress: Optional[ProgressFn], stage: str, pct: float, msg: str) -> None:
    """呼叫 progress callback,任何例外都吞掉(回報進度絕不能讓管線中斷)。"""
    if progress is None:
        return
    try:
        progress(stage, float(pct), msg)
    except Exception:  # pragma: no cover - 防禦性
        logger.debug("progress callback raised; ignored", exc_info=True)


def _band_progress(
    progress: Optional[ProgressFn],
    lo: float,
    hi: float,
    stage_label: str,
) -> ProgressFn:
    """產生一個把子步驟 0..100 的 pct 重新映射到 [lo, hi] 區間的 callback。

    這樣 separate / transcribe / align 內部即使各自回報 0-100,對外仍呈現
    連續遞增的全域進度條(分離 0-40、辨識 40-95、收尾 95-100)。
    """

    span = max(0.0, hi - lo)

    def _inner(stage: str, pct: float, msg: str) -> None:
        try:
            p = float(pct)
        except (TypeError, ValueError):
            p = 0.0
        p = max(0.0, min(100.0, p))
        global_pct = lo + (p / 100.0) * span
        # 子步驟可能會回報自己的 stage 字串;統一掛上區段標籤讓 UI 三段式 stepper 對齊。
        _safe_progress(progress, stage or stage_label, global_pct, msg)

    return _inner


def _resolve_device(device: str) -> str:
    """解析 device:'auto' -> 若 torch.cuda 可用則 cuda,否則 cpu。

    torch 在 try 內 import —— 缺席或匯入失敗時退回 cpu,絕不拋出。
    """
    dev = (device or "auto").strip().lower()
    if dev in ("cuda", "cpu"):
        return dev
    if dev != "auto":
        # 非預期值,保守退回 auto 解析
        logger.warning("未知 device %r,改以 auto 解析", device)

    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        logger.info("torch 不可用或無 CUDA,改用 CPU", exc_info=False)
    return "cpu"


def _probe_duration(audio_path: str, segments: list[dict]) -> float:
    """計算音訊總長度(秒)。

    優先用 soundfile 讀檔頭(frames / samplerate);失敗則退回最後一個 word 的
    end,再退回最後一個 segment 的 end,最後退回 0.0。
    """
    # 1) soundfile 讀檔頭(快,不載入整段音訊)
    try:
        import soundfile as sf  # type: ignore

        info = sf.info(audio_path)
        if info.samplerate:
            dur = float(info.frames) / float(info.samplerate)
            if dur > 0:
                return round(dur, 3)
    except Exception:
        logger.debug("soundfile 無法取得時長,改用詞/段落 end 回退", exc_info=True)

    # 2) 回退:最後一個 word 的 end
    last = 0.0
    for seg in segments:
        for w in seg.get("words") or []:
            try:
                last = max(last, float(w.get("end") or 0.0))
            except (TypeError, ValueError):
                continue
    if last > 0:
        return round(last, 3)

    # 3) 回退:最後一個 segment 的 end
    for seg in segments:
        try:
            last = max(last, float(seg.get("end") or 0.0))
        except (TypeError, ValueError):
            continue
    return round(last, 3)


def _normalize_segments(raw_segments: Any) -> list[dict]:
    """把子步驟回傳的 segments 正規化成 Result.segments 形狀並指派 id。

    強制每個 segment 具備 id / start / end / text / words,且每個 word 具備
    start / end / word / prob —— 缺漏一律補預設值,避免下游(export / 前端)崩潰。
    """
    out: list[dict] = []
    if not isinstance(raw_segments, list):
        return out

    for idx, seg in enumerate(raw_segments):
        if not isinstance(seg, dict):
            continue

        words_out: list[dict] = []
        for w in seg.get("words") or []:
            if not isinstance(w, dict):
                continue
            try:
                w_start = float(w.get("start") or 0.0)
            except (TypeError, ValueError):
                w_start = 0.0
            try:
                w_end = float(w.get("end") or 0.0)
            except (TypeError, ValueError):
                w_end = 0.0
            try:
                prob = float(w.get("prob") if w.get("prob") is not None else 1.0)
            except (TypeError, ValueError):
                prob = 1.0
            # prob 夾在 0..1
            prob = max(0.0, min(1.0, prob))
            words_out.append(
                {
                    "start": w_start,
                    "end": w_end,
                    "word": str(w.get("word", "")),
                    "prob": prob,
                }
            )

        try:
            s_start = float(seg.get("start") or 0.0)
        except (TypeError, ValueError):
            s_start = 0.0
        try:
            s_end = float(seg.get("end") or 0.0)
        except (TypeError, ValueError):
            s_end = 0.0

        # 若 segment 缺 start/end 但有 words,用 words 邊界補齊
        if words_out:
            if not s_start:
                s_start = words_out[0]["start"]
            if not s_end:
                s_end = words_out[-1]["end"]

        out.append(
            {
                "id": idx,
                "start": s_start,
                "end": s_end,
                "text": str(seg.get("text", "")).strip("\n") if seg.get("text") is not None else "",
                "words": words_out,
            }
        )

    return out


# ---------------------------------------------------------------------------
# 逐字時間軸精修(讓字幕/卡拉OK 跳色更貼拍)
# ---------------------------------------------------------------------------
_MIN_WORD_DUR = 0.04  # 每個字至少給 40ms,讓逐字高亮不會「閃過」


def _finite(x: float, fallback: float) -> float:
    """非有限值(NaN / inf)→ 回 fallback。Whisper 偶發 NaN 時間戳的安全網。"""
    return x if math.isfinite(x) else fallback


def _clean_word_timing(segments: list[dict], extend_min_dur: bool = True) -> None:
    """就地把每段的逐字時間整理成「單調、不重疊、夾在句界內、值有限」。

    Whisper 的逐字時間戳偶爾會重疊 / 倒退 / 零長度 / NaN,直接拿去做動態字幕會
    跳色錯亂或讓時間格式化爆掉。這個純後處理對**所有模式**都套用(是修正):
      - 修掉 NaN/inf(換成上一個 end)
      - start 不早於上一個字的 end(去重疊、維持單調)、夾在 [seg.start, seg.end]
      - (extend_min_dur=True)給每個字至少 _MIN_WORD_DUR 長度,但不越過下一個字 start

    extend_min_dur 在強制對齊(align)模式關閉 —— align 的時間本來就準確,
    只做去重疊/夾界的修正(phase 1),不去動它的長度,保持逐字時間原樣。
    整段每句各自 try/except,絕不讓收尾步驟崩潰一個 job。
    """
    for seg in segments or []:
        try:
            words = seg.get("words") or []
            if not words:
                continue
            s_lo = _finite(float(seg.get("start") or 0.0), 0.0)
            s_hi = _finite(float(seg.get("end") or s_lo), s_lo)
            if s_hi < s_lo:
                s_hi = s_lo
            # (1) 修 NaN/inf、單調、不重疊、夾在句界
            prev_end = s_lo
            for w in words:
                try:
                    ws = float(w.get("start") if w.get("start") is not None else prev_end)
                    we = float(w.get("end") if w.get("end") is not None else ws)
                except (TypeError, ValueError):
                    ws, we = prev_end, prev_end
                ws = _finite(ws, prev_end)
                we = _finite(we, ws)
                ws = min(max(ws, prev_end), s_hi)
                we = min(max(we, ws), s_hi)
                w["start"] = ws
                w["end"] = we
                prev_end = we
            # (2) 補足最小長度(不越過下一個字 start);align 模式跳過以保留原時間
            if extend_min_dur:
                n = len(words)
                for i, w in enumerate(words):
                    nxt = float(words[i + 1]["start"]) if i + 1 < n else s_hi
                    if w["end"] - w["start"] < _MIN_WORD_DUR:
                        w["end"] = min(w["start"] + _MIN_WORD_DUR, max(nxt, w["start"]))
            # 四捨五入(單調保序,不會因進位產生重疊)
            for w in words:
                w["start"] = round(float(w["start"]), 3)
                w["end"] = round(float(w["end"]), 3)
        except Exception:  # noqa: BLE001 - 收尾整理絕不崩潰
            logger.debug("逐字時間整理失敗(已略過該段)", exc_info=True)


def _snap_transcribe_onsets(audio_path: str, recog: dict) -> None:
    """精準模式:把**辨識路徑**(非強制對齊)的逐字 start 吸附到人聲能量起音點。

    重用 align 的 onset 偵測 / 吸附(純 numpy、O(N)),把 Whisper 較鬆的逐字 start
    收緊到真實起音點 —— 對動態字幕 / 卡拉OK 的「卡拍感」有感。整段 try/except,
    失敗就保留原時間(降級契約),絕不影響主流程。
    """
    segs = recog.get("segments") or []
    words = [w for seg in segs for w in (seg.get("words") or [])]
    if not words:
        return
    try:
        wav = _align._load_waveform(audio_path, 16000)
        import numpy as np  # type: ignore

        wav_np = wav.numpy().reshape(-1) if hasattr(wav, "numpy") else np.asarray(wav).reshape(-1)
        onsets = _align._compute_onsets(wav_np, 16000)
        _align._snap_starts(words, onsets)
    except Exception:
        logger.debug("辨識路徑 onset 吸附失敗(已略過)", exc_info=True)


def _cuda_free_mb() -> Optional[float]:
    """目前 CUDA 可用 VRAM(MB);torch/CUDA 缺席或查詢失敗回 None。"""
    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return None
        free, _total = torch.cuda.mem_get_info()
        return float(free) / (1024.0 * 1024.0)
    except Exception:  # noqa: BLE001
        return None


def _empty_cuda_cache() -> None:
    """釋放 torch CUDA 快取塊(分離/辨識之間騰出 VRAM),失敗無聲略過。"""
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:  # noqa: BLE001
        pass


# ---------------------------------------------------------------------------
# 主協調器
# ---------------------------------------------------------------------------
def run(
    audio_path: str,
    *,
    mode: str = "auto",
    reference_lyrics: str = "",
    reference_content: str = "",
    style_keys: Optional[list[str]] = None,
    language: Optional[str] = None,
    model_size: str = "large-v3",
    separate: bool = True,
    device: str = "auto",
    engine: str = "whisper",
    refine: bool = True,
    demucs_model: str = "htdemucs",
    task: Optional[str] = None,
    precision: bool = False,
    progress: Optional[ProgressFn] = None,
) -> dict:
    """跑完整辨識/對齊管線,回傳符合 API_CONTRACT 的 Result dict。

    參數
    ----
    audio_path: 待處理的音訊/影片檔路徑(PyAV 可解碼 mp4/mkv/mov/webm 等)。
    mode: "auto" | "biasing" | "align" | "speech"。
        - "align" 且 reference_lyrics 非空 -> 走強制對齊(完整歌詞,接近完美)。
        - "biasing" -> 用 build_bias_prompt 組 initial_prompt 餵給辨識器偏置。
        - "speech" -> 影片→字幕模式:純語音辨識,無任何偏置;預設不做人聲分離
          (separate 由呼叫端決定,通常為 False)。modeUsed 回 "speech"。
        - 其他("auto")-> 純辨識。
    reference_lyrics: 完整歌詞(多行,line break 有意義),供 align 使用,亦作偏置素材。
    reference_content: 自由形式提示文字,供 biasing 使用。
    style_keys: 曲風 preset key 列表(對應 config.STYLE_PRESETS)。
    language: whisper 語言碼或 None(自動偵測)。align 時透過 to_iso3 轉 ISO-639-3。
    model_size: "large-v3" | "medium" | "small"。
    separate: 是否先跑 Demucs 人聲分離。
    device: "auto" | "cuda" | "cpu"。
    engine: 目前僅 "whisper"。
    refine: 是否在強制對齊後把每個詞的邊界吸附到最近的人聲起點(預設 True)。
    demucs_model: Demucs 模型名稱 — "htdemucs"(標準)或 "htdemucs_ft"(高品質微調版,較慢)。
    task: faster-whisper 任務("transcribe"/"translate");None == "transcribe"。
        目前僅供 "speech" 模式前向掛鉤未來在地翻譯之用;本管線不附帶翻譯模型。
    progress: progress(stage, pct, msg) 全域進度回報。

    回傳
    ----
    {
      "language": str,
      "modeUsed": "auto" | "biasing" | "align" | "speech",
      "segments": [ {"id","start","end","text","words":[...]} ],
      "meta": {"modelSize","separated","durationSec","engine"}
    }
    """
    if progress is None:
        progress = _noop_progress
    # 全程以單調包裝,確保全域 pct 不倒退(三段式 stepper 邊界平滑)。
    progress = _MonotonicProgress(progress)
    style_keys = style_keys or []
    reference_lyrics = reference_lyrics or ""
    reference_content = reference_content or ""
    mode = (mode or "auto").strip().lower()
    engine = engine or "whisper"

    _safe_progress(progress, "init", 0.0, "準備中 · Preparing")

    # --- 1) 解析裝置 ---------------------------------------------------------
    resolved_device = _resolve_device(device)
    logger.info("device 解析:%r -> %r", device, resolved_device)

    # --- 2) 人聲分離(0-40)-------------------------------------------------
    vocals_path = audio_path
    separated = False
    if separate:
        try:
            if _separate.is_available():
                _safe_progress(progress, "separate", 1.0, "分離人聲 · Separating vocals")
                sep_progress = _band_progress(progress, 0.0, 40.0, "separate")
                # Validate demucs_model; fall back to htdemucs for unknown values.
                safe_demucs = demucs_model if demucs_model in ("htdemucs", "htdemucs_ft") else "htdemucs"
                # 精準模式 + GPU + 顯存充足:開 test-time augmentation(shifts=1)→ 人聲更
                # 乾淨、辨識更準。VRAM 不足(< 3GB free)時不開 —— 避免分離的暫態 VRAM 和
                # 後續 Whisper 疊起來 OOM(呼應 v0.1.8 的顯存守門);只在 cuda 開(CPU 已慢)。
                free_mb = _cuda_free_mb() if resolved_device == "cuda" else None
                sep_shifts = (
                    1 if (precision and resolved_device == "cuda" and (free_mb or 0) > 3000) else 0
                )
                result_path = _separate.separate_vocals(
                    audio_path,
                    out_dir=_sep_out_dir(audio_path),
                    model_name=safe_demucs,
                    device=resolved_device,
                    shifts=sep_shifts,
                    progress=sep_progress,
                )
                _empty_cuda_cache()  # 分離後釋放暫態 VRAM,降低後續辨識 OOM 機率
                if result_path and result_path != audio_path:
                    vocals_path = result_path
                    separated = True
                else:
                    # separate_vocals 已優雅退回原檔(內部失敗或 demucs 缺席)
                    vocals_path = audio_path
                    separated = False
            else:
                logger.info("Demucs 不可用,跳過人聲分離")
                _safe_progress(progress, "separate", 40.0, "略過人聲分離 · Demucs unavailable")
        except Exception:
            # 任何分離例外 -> 退回原音訊,絕不中斷
            logger.warning("人聲分離失敗,改用原始音訊", exc_info=True)
            vocals_path = audio_path
            separated = False
    else:
        _safe_progress(progress, "separate", 40.0, "未啟用人聲分離 · Separation off")

    # 確保進入辨識前進度至少到 40
    _safe_progress(progress, "recognize", 40.0, "開始辨識 · Starting recognition")

    # --- 3) 派工:align / biasing / auto(40-95)----------------------------
    recog_progress = _band_progress(progress, 40.0, 95.0, "recognize")
    mode_used = "auto"
    recog: dict[str, Any] = {"language": "", "segments": []}

    want_align = mode == "align" and reference_lyrics.strip()

    if want_align:
        # 完整歌詞強制對齊。若 aligner 不可用則優雅退回辨識。
        aligner_ok = False
        try:
            aligner_ok = _align.is_available()
        except Exception:
            logger.warning("aligner is_available 檢查失敗", exc_info=True)
            aligner_ok = False

        if aligner_ok:
            try:
                iso3 = config.to_iso3(language)
                # 原始 whisper 碼(保留 zh vs yue)→ 讓 align 選對羅馬化器(pinyin/jyutping)。
                lang_code = config.normalize_align_lang(language)
                _safe_progress(progress, "align", 41.0, "強制對齊 · Forced alignment")
                recog = _align.align(
                    vocals_path,
                    reference_lyrics,
                    language=iso3,
                    device=resolved_device,
                    refine=bool(refine),
                    lang_code=lang_code,
                    progress=recog_progress,
                )
                mode_used = "align"
            except Exception:
                logger.warning("強制對齊失敗,改走辨識(biasing 回退)", exc_info=True)
                recog = _fallback_transcribe(
                    vocals_path,
                    language=language,
                    initial_prompt=_safe_bias_prompt(style_keys, reference_content, reference_lyrics),
                    model_size=model_size,
                    device=resolved_device,
                    precision=precision,
                    hotwords=reference_lyrics,
                    progress=recog_progress,
                )
                mode_used = "biasing"
        else:
            logger.info("aligner 不可用,align 模式回退為 biasing 辨識")
            recog = _fallback_transcribe(
                vocals_path,
                language=language,
                initial_prompt=_safe_bias_prompt(style_keys, reference_content, reference_lyrics),
                model_size=model_size,
                device=resolved_device,
                precision=precision,
                hotwords=reference_lyrics,
                progress=recog_progress,
            )
            mode_used = "biasing"

    elif mode == "speech":
        # 影片→字幕模式:純語音辨識,無任何偏置;task 透傳給辨識器(未來翻譯前向掛鉤)。
        _safe_progress(progress, "recognize", 41.0, "辨識語音 · Transcribing speech")
        recog = _fallback_transcribe(
            vocals_path,
            language=language,
            initial_prompt=None,
            model_size=model_size,
            device=resolved_device,
            task=task,
            precision=precision,
            hotwords=reference_lyrics,
            progress=recog_progress,
        )
        mode_used = "speech"

    elif mode == "biasing":
        initial_prompt = _safe_bias_prompt(style_keys, reference_content, reference_lyrics)
        _safe_progress(progress, "recognize", 41.0, "偏置辨識 · Biased recognition")
        recog = _fallback_transcribe(
            vocals_path,
            language=language,
            initial_prompt=initial_prompt,
            model_size=model_size,
            device=resolved_device,
            precision=precision,
            hotwords=reference_lyrics,
            progress=recog_progress,
        )
        mode_used = "biasing"

    else:
        # 純辨識(auto)
        _safe_progress(progress, "recognize", 41.0, "辨識中 · Transcribing")
        recog = _fallback_transcribe(
            vocals_path,
            language=language,
            initial_prompt=None,
            model_size=model_size,
            device=resolved_device,
            precision=precision,
            hotwords=reference_lyrics,
            progress=recog_progress,
        )
        mode_used = "auto"

    if not isinstance(recog, dict):
        logger.warning("辨識/對齊回傳非 dict(%r),改用空結果", type(recog))
        recog = {"language": "", "segments": []}

    # 精準模式:辨識路徑(auto/biasing/speech)的逐字 start 吸附到人聲起音點。
    # 強制對齊(align)在 align.align 內部已做吸附,故這裡只處理辨識路徑。
    if precision and mode_used in ("auto", "biasing", "speech"):
        _snap_transcribe_onsets(vocals_path, recog)

    # --- 4) 收尾:指派 id、算時長、組裝 Result(95-100)---------------------
    _safe_progress(progress, "finalize", 95.0, "整理結果 · Finalizing")

    segments = _normalize_segments(recog.get("segments"))
    # 逐字時間整理:單調、不重疊、夾界、修 NaN —— 讓動態字幕/卡拉OK 跳色更穩。
    # align 模式時間本就準 → 不做最小長度延伸,保留原逐字時間。
    _clean_word_timing(segments, extend_min_dur=(mode_used != "align"))
    duration = _probe_duration(audio_path, segments)
    out_language = recog.get("language") or (language or "")

    result: dict[str, Any] = {
        "language": str(out_language),
        "modeUsed": mode_used,
        "segments": segments,
        "meta": {
            "modelSize": model_size,
            "separated": bool(separated),
            "durationSec": float(duration),
            "engine": engine,
        },
    }

    _safe_progress(progress, "done", 100.0, "完成 · Done")
    return result


# ---------------------------------------------------------------------------
# 子步驟薄包裝(集中錯誤處理)
# ---------------------------------------------------------------------------
def _sep_out_dir(audio_path: str) -> str:
    """為 Demucs 輸出選一個目錄(音訊檔同層的子資料夾)。"""
    import os

    base = os.path.dirname(os.path.abspath(audio_path)) or "."
    out = os.path.join(base, "_separated")
    try:
        os.makedirs(out, exist_ok=True)
    except Exception:
        logger.debug("無法建立分離輸出目錄,改用音訊檔同層", exc_info=True)
        return base
    return out


def _safe_bias_prompt(
    style_keys: list[str],
    reference_content: str,
    partial_lyrics: str,
) -> Optional[str]:
    """安全地呼叫 config.build_bias_prompt;失敗則回 None(等同無偏置)。"""
    try:
        prompt = config.build_bias_prompt(style_keys, reference_content, partial_lyrics)
        prompt = (prompt or "").strip()
        return prompt or None
    except Exception:
        logger.warning("build_bias_prompt 失敗,改用無偏置提示", exc_info=True)
        return None


def _fallback_transcribe(
    audio_path: str,
    *,
    language: Optional[str],
    initial_prompt: Optional[str],
    model_size: str,
    device: str,
    task: Optional[str] = None,
    precision: bool = False,
    hotwords: Optional[str] = None,
    progress: Optional[ProgressFn],
) -> dict:
    """呼叫 transcribe.transcribe;任何例外回傳空結果結構,不讓管線崩潰。"""
    try:
        out = _transcribe.transcribe(
            audio_path,
            language=language,
            initial_prompt=initial_prompt,
            model_size=model_size,
            device=device,
            task=task,
            precision=precision,
            hotwords=hotwords,
            progress=progress,
        )
        if isinstance(out, dict):
            return out
        logger.warning("transcribe 回傳非 dict(%r),改用空結果", type(out))
    except Exception:
        logger.error("辨識失敗,回傳空結果", exc_info=True)
    return {"language": language or "", "segments": []}
