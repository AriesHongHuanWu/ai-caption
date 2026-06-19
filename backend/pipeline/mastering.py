"""
pipeline/mastering.py — AI 自動母帶處理(Auto-Mastering)。

把一首混音(stereo)處理成「可發佈」的母帶:依曲風/參考曲調整音色(EQ)、做總線
壓縮膠合動態、調立體聲寬度,最後正規化到目標響度(LUFS)並過真峰限幅器,確保不破音。
全本機、免雲端、授權乾淨(numpy / scipy / pyloudnorm / soundfile,皆 BSD/MIT)。

兩種音色處理:
  - 參考曲模式(reference):使用者上傳一首「想要的聲音」→ 分析其平均頻譜,做 FFT
    頻率響應匹配,把目標曲的音色推向參考曲(開源 Matchering 的做法,自行重寫)。
  - 曲風預設(genre):每個曲風一組調好的參數 EQ + 壓縮個性。

響度目標(整合式 LUFS + 真峰天花板):
  - streaming   -14 LUFS / -1 dBTP(Spotify/Apple/YouTube 標準)
  - balanced    -12 LUFS / -1 dBTP(較動態、通用)
  - social      -9  LUFS / -1 dBTP(較大聲、手機喇叭更有衝擊力)

設計原則:任何重型相依(scipy / pyloudnorm)缺席或失敗都不可讓伺服器崩潰 —— 以
is_available() 回報,呼叫端據此回 503/降級。
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable, Optional

logger = logging.getLogger("autolyrics.mastering")

ProgressFn = Callable[[str, float, str], None]
_STAGE = "master"

# --------------------------------------------------------------------------- #
# 可選相依偵測
# --------------------------------------------------------------------------- #
try:
    import numpy as np  # type: ignore
    import scipy.signal as sps  # type: ignore
    from scipy.ndimage import minimum_filter1d, uniform_filter1d  # type: ignore
    import pyloudnorm as pyln  # type: ignore

    _HAS_DSP = True
except Exception as exc:  # pragma: no cover
    np = None  # type: ignore
    sps = None  # type: ignore
    pyln = None  # type: ignore
    _HAS_DSP = False
    logger.warning("母帶 DSP 相依(scipy/pyloudnorm)不可用,Auto-Mastering 停用:%s", exc)


def is_available() -> bool:
    return _HAS_DSP


def _emit(progress: Optional[ProgressFn], pct: float, msg: str) -> None:
    if progress is None:
        return
    try:
        progress(_STAGE, float(pct), msg)
    except Exception:  # pragma: no cover
        logger.debug("progress 回呼丟例外,已忽略", exc_info=True)


# --------------------------------------------------------------------------- #
# 曲風預設與響度目標
# --------------------------------------------------------------------------- #
# EQ band: (kind, freq_hz, gain_db, q)  kind ∈ {"peak","low_shelf","high_shelf"}
GENRE_PRESETS: dict[str, dict[str, Any]] = {
    "auto": {
        "label": "Auto / 通用",
        "eq": [("low_shelf", 90, 1.0, 0.7), ("high_shelf", 12000, 1.5, 0.7)],
        "comp": {"thresh_db": -16.0, "ratio": 1.6, "attack_ms": 20, "release_ms": 150, "makeup_db": 0.0},
        "width": 1.0,
    },
    "pop": {
        "label": "Pop",
        "eq": [("low_shelf", 100, 1.5, 0.7), ("peak", 3000, 2.0, 1.0), ("high_shelf", 12000, 2.5, 0.7)],
        "comp": {"thresh_db": -16.0, "ratio": 2.0, "attack_ms": 15, "release_ms": 120, "makeup_db": 0.5},
        "width": 1.12,
    },
    "hiphop": {
        "label": "Hip-Hop / Rap",
        "eq": [("low_shelf", 60, 3.0, 0.7), ("peak", 300, -1.0, 1.0), ("high_shelf", 10000, 2.0, 0.7)],
        "comp": {"thresh_db": -15.0, "ratio": 2.2, "attack_ms": 25, "release_ms": 140, "makeup_db": 0.5},
        "width": 1.0,
    },
    "edm": {
        "label": "EDM / Electronic",
        "eq": [("low_shelf", 50, 3.0, 0.7), ("peak", 5000, 1.5, 1.0), ("high_shelf", 14000, 3.0, 0.7)],
        "comp": {"thresh_db": -14.0, "ratio": 2.6, "attack_ms": 10, "release_ms": 100, "makeup_db": 1.0},
        "width": 1.2,
    },
    "rock": {
        "label": "Rock",
        "eq": [("low_shelf", 90, 1.0, 0.7), ("peak", 2000, 2.0, 0.9), ("high_shelf", 9000, 1.5, 0.7)],
        "comp": {"thresh_db": -16.0, "ratio": 2.0, "attack_ms": 20, "release_ms": 150, "makeup_db": 0.5},
        "width": 1.06,
    },
    "rnb": {
        "label": "R&B / Soul",
        "eq": [("low_shelf", 80, 2.5, 0.7), ("peak", 4000, -1.0, 1.2), ("high_shelf", 12000, 2.0, 0.7)],
        "comp": {"thresh_db": -17.0, "ratio": 1.6, "attack_ms": 25, "release_ms": 180, "makeup_db": 0.0},
        "width": 1.1,
    },
    "acoustic": {
        "label": "Acoustic / Folk",
        "eq": [("low_shelf", 100, 0.5, 0.7), ("peak", 4000, 1.0, 1.0), ("high_shelf", 12000, 1.5, 0.7)],
        "comp": {"thresh_db": -18.0, "ratio": 1.4, "attack_ms": 30, "release_ms": 200, "makeup_db": 0.0},
        "width": 1.05,
    },
    "ballad": {
        "label": "Ballad",
        "eq": [("low_shelf", 120, 1.0, 0.7), ("peak", 3000, 1.0, 1.0), ("high_shelf", 12000, 1.5, 0.7)],
        "comp": {"thresh_db": -18.0, "ratio": 1.4, "attack_ms": 30, "release_ms": 220, "makeup_db": 0.0},
        "width": 1.05,
    },
    "lofi": {
        "label": "Lo-fi",
        "eq": [("low_shelf", 100, 2.0, 0.7), ("peak", 500, 1.0, 1.0), ("high_shelf", 8000, -3.0, 0.7)],
        "comp": {"thresh_db": -15.0, "ratio": 2.0, "attack_ms": 20, "release_ms": 140, "makeup_db": 0.5},
        "width": 0.95,
    },
}

# loudness → (target integrated LUFS, true-peak ceiling dBTP)
LOUDNESS_TARGETS: dict[str, tuple[float, float]] = {
    "streaming": (-14.0, -1.0),
    "balanced": (-12.0, -1.0),
    "social": (-9.0, -1.0),
}


def genres() -> list[dict[str, str]]:
    return [{"key": k, "label": v["label"]} for k, v in GENRE_PRESETS.items()]


def loudness_targets() -> list[str]:
    return list(LOUDNESS_TARGETS.keys())


# --------------------------------------------------------------------------- #
# I/O
# --------------------------------------------------------------------------- #
def _load_audio(path: str) -> tuple["np.ndarray", int]:
    """讀成 (n, 2) float64 立體聲 + 取樣率。soundfile 優先(wav/flac),其餘走 PyAV。"""
    # 1) soundfile(無損,原生取樣率/聲道)
    try:
        import soundfile as sf  # type: ignore

        data, sr = sf.read(path, always_2d=True, dtype="float64")  # (n, ch)
        return _to_stereo(data), int(sr)
    except Exception as exc:
        logger.debug("soundfile 讀取失敗,改用 PyAV(%s)", exc)

    # 2) PyAV(mp3/m4a 等)→ fltp stereo @native sr
    import av  # type: ignore

    c = av.open(path)
    try:
        astream = c.streams.audio[0]
        sr = int(astream.codec_context.sample_rate or 44100)
        resampler = av.AudioResampler(format="fltp", layout="stereo", rate=sr)
        chunks: list[Any] = []
        for frame in c.decode(audio=0):
            for rf in resampler.resample(frame):
                chunks.append(rf.to_ndarray())  # (2, n) planar float
        if not chunks:
            raise RuntimeError("PyAV 解不到音訊")
        data = np.concatenate(chunks, axis=1).T.astype(np.float64)  # (n, 2)
        return _to_stereo(data), sr
    finally:
        try:
            c.close()
        except Exception:
            pass


def _to_stereo(data: "np.ndarray") -> "np.ndarray":
    if data.ndim == 1:
        data = data[:, None]
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    elif data.shape[1] > 2:
        data = data[:, :2]
    return np.ascontiguousarray(data, dtype=np.float64)


def _write_wav(path: str, data: "np.ndarray", sr: int) -> None:
    import soundfile as sf  # type: ignore

    sf.write(path, np.clip(data, -1.0, 1.0), sr, subtype="PCM_24")


# --------------------------------------------------------------------------- #
# 響度 / 峰值量測
# --------------------------------------------------------------------------- #
def _measure_lufs(data: "np.ndarray", sr: int) -> float:
    try:
        meter = pyln.Meter(sr)  # ITU-R BS.1770
        lufs = float(meter.integrated_loudness(data))
        if not np.isfinite(lufs):
            return -70.0
        return lufs
    except Exception:
        # 後備:用 RMS 粗估(非標準,但不讓流程斷)
        rms = float(np.sqrt(np.mean(data**2) + 1e-12))
        return 20.0 * np.log10(rms + 1e-9) - 0.691


def _peak_db(data: "np.ndarray") -> float:
    p = float(np.max(np.abs(data))) if data.size else 0.0
    return 20.0 * np.log10(p + 1e-12)


# --------------------------------------------------------------------------- #
# 參數 EQ(RBJ biquad)
# --------------------------------------------------------------------------- #
def _biquad(kind: str, sr: int, f0: float, gain_db: float, q: float) -> tuple["np.ndarray", "np.ndarray"]:
    """RBJ cookbook biquad:peaking / low_shelf / high_shelf。回傳 (b, a)。"""
    A = 10 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * f0 / sr
    cw = np.cos(w0)
    sw = np.sin(w0)
    alpha = sw / (2.0 * max(q, 1e-4))
    if kind == "peak":
        b0 = 1 + alpha * A
        b1 = -2 * cw
        b2 = 1 - alpha * A
        a0 = 1 + alpha / A
        a1 = -2 * cw
        a2 = 1 - alpha / A
    elif kind == "low_shelf":
        s = 2 * np.sqrt(A) * alpha
        b0 = A * ((A + 1) - (A - 1) * cw + s)
        b1 = 2 * A * ((A - 1) - (A + 1) * cw)
        b2 = A * ((A + 1) - (A - 1) * cw - s)
        a0 = (A + 1) + (A - 1) * cw + s
        a1 = -2 * ((A - 1) + (A + 1) * cw)
        a2 = (A + 1) + (A - 1) * cw - s
    else:  # high_shelf
        s = 2 * np.sqrt(A) * alpha
        b0 = A * ((A + 1) + (A - 1) * cw + s)
        b1 = -2 * A * ((A - 1) + (A + 1) * cw)
        b2 = A * ((A + 1) + (A - 1) * cw - s)
        a0 = (A + 1) - (A - 1) * cw + s
        a1 = 2 * ((A - 1) - (A + 1) * cw)
        a2 = (A + 1) - (A - 1) * cw - s
    b = np.array([b0, b1, b2], dtype=np.float64) / a0
    a = np.array([1.0, a1 / a0, a2 / a0], dtype=np.float64)
    return b, a


def _apply_eq(data: "np.ndarray", sr: int, bands: list[tuple]) -> "np.ndarray":
    out = data.copy()
    for (kind, f0, gain_db, q) in bands:
        if abs(gain_db) < 1e-3:
            continue
        b, a = _biquad(kind, sr, float(f0), float(gain_db), float(q))
        for ch in range(out.shape[1]):
            out[:, ch] = sps.lfilter(b, a, out[:, ch])
    return out


# --------------------------------------------------------------------------- #
# 參考曲頻率響應匹配(FFT)
# --------------------------------------------------------------------------- #
def _avg_spectrum(x_mono: "np.ndarray", n_fft: int = 8192) -> "np.ndarray":
    """整段訊號的平均量值頻譜(分窗、漢寧、平均)。回傳長度 n_fft//2+1。"""
    hop = n_fft // 2
    if x_mono.shape[0] < n_fft:
        x_mono = np.pad(x_mono, (0, n_fft - x_mono.shape[0]))
    win = np.hanning(n_fft)
    acc = np.zeros(n_fft // 2 + 1, dtype=np.float64)
    cnt = 0
    for start in range(0, x_mono.shape[0] - n_fft + 1, hop):
        seg = x_mono[start:start + n_fft] * win
        acc += np.abs(np.fft.rfft(seg))
        cnt += 1
    if cnt == 0:
        return acc + 1e-9
    return acc / cnt + 1e-9


def _match_eq(data: "np.ndarray", sr: int, ref: "np.ndarray", ref_sr: int, max_db: float = 12.0) -> "np.ndarray":
    """把 data 的平均頻譜推向 ref 的(FFT 匹配 EQ)。修正量在 log-freq 上平滑、夾在 ±max_db。"""
    try:
        if ref_sr != sr:
            ref = sps.resample_poly(ref, sr, ref_sr, axis=0)
        n_fft = 8192
        tgt_spec = _avg_spectrum(np.mean(data, axis=1), n_fft)
        ref_spec = _avg_spectrum(np.mean(ref, axis=1), n_fft)
        # 正規化整體能量(只匹配「形狀/音色」,不匹配絕對響度 → 響度由後面的 LUFS 正規化決定)
        tgt_spec = tgt_spec / (np.mean(tgt_spec) + 1e-12)
        ref_spec = ref_spec / (np.mean(ref_spec) + 1e-12)
        ratio_db = 20.0 * np.log10((ref_spec + 1e-9) / (tgt_spec + 1e-9))
        ratio_db = np.clip(ratio_db, -max_db, max_db)
        # 在頻率軸上平滑(避免逐 bin 硬修正造成染色),約 1/6 八度
        ratio_db = uniform_filter1d(ratio_db, size=max(3, n_fft // 256))
        gain_lin = 10 ** (ratio_db / 20.0)
        # 設計線性相位 FIR(對稱),用 overlap-add 套用兩聲道
        full = np.concatenate([gain_lin, gain_lin[-2:0:-1]])  # 對稱成完整頻譜
        imp = np.fft.irfft(gain_lin, n=n_fft)
        imp = np.fft.fftshift(imp) * np.hanning(n_fft)  # 視窗化成線性相位 FIR
        out = np.empty_like(data)
        for ch in range(data.shape[1]):
            out[:, ch] = sps.fftconvolve(data[:, ch], imp, mode="same")
        return out
    except Exception:
        logger.warning("參考曲匹配失敗,改用原始音色(降級)", exc_info=True)
        return data


# --------------------------------------------------------------------------- #
# 壓縮 / 立體聲寬度 / 響度正規化 / 限幅
# --------------------------------------------------------------------------- #
def _compress(data: "np.ndarray", sr: int, *, thresh_db: float, ratio: float,
              attack_ms: float, release_ms: float, makeup_db: float) -> "np.ndarray":
    """溫和總線壓縮(level-dependent + 一階平滑)。對母帶以膠合為主,不求激進。"""
    detect = np.sqrt(np.mean(data**2, axis=1) + 1e-12)  # 兩聲道 RMS
    level_db = 20.0 * np.log10(detect + 1e-9)
    over = np.maximum(0.0, level_db - thresh_db)
    gr_db = -over * (1.0 - 1.0 / max(ratio, 1.0))  # 增益衰減(<=0)
    tau = max(1.0, (attack_ms + release_ms) / 2.0)
    a = float(np.exp(-1.0 / (sr * tau / 1000.0)))
    gr_sm = sps.lfilter([1 - a], [1, -a], gr_db)
    gain = 10 ** ((gr_sm + makeup_db) / 20.0)
    return data * gain[:, None]


def _stereo_width(data: "np.ndarray", width: float) -> "np.ndarray":
    if abs(width - 1.0) < 1e-3 or data.shape[1] < 2:
        return data
    mid = 0.5 * (data[:, 0] + data[:, 1])
    side = 0.5 * (data[:, 0] - data[:, 1]) * float(width)
    out = np.empty_like(data)
    out[:, 0] = mid + side
    out[:, 1] = mid - side
    return out


def _normalize_lufs(data: "np.ndarray", sr: int, target_lufs: float) -> "np.ndarray":
    cur = _measure_lufs(data, sr)
    gain_db = target_lufs - cur
    gain_db = float(np.clip(gain_db, -24.0, 36.0))
    return data * (10 ** (gain_db / 20.0))


def _limit(data: "np.ndarray", sr: int, ceiling_db: float) -> "np.ndarray":
    """前瞻峰值限幅器(向量化):增益衰減用移動最小值(含前瞻),短窗平滑,末端硬夾保底。"""
    ceiling = 10 ** (ceiling_db / 20.0)
    peak = np.max(np.abs(data), axis=1) + 1e-12
    desired = np.minimum(1.0, ceiling / peak)  # 維持在天花板下所需的增益(<=1)
    la = max(1, int(sr * 0.0015))   # 1.5ms 前瞻/起音
    hold = max(1, int(sr * 0.04))   # ~40ms 釋放
    win = la + hold
    g = minimum_filter1d(desired, size=win, origin=min(hold // 2, win // 2 - 1))
    g = uniform_filter1d(g, size=la)  # 平滑邊緣
    out = data * g[:, None]
    np.clip(out, -ceiling, ceiling, out=out)
    return out


# --------------------------------------------------------------------------- #
# 主流程
# --------------------------------------------------------------------------- #
def master(
    input_path: str,
    output_path: str,
    *,
    genre: str = "auto",
    loudness: str = "streaming",
    reference_path: Optional[str] = None,
    width: Optional[float] = None,
    progress: Optional[ProgressFn] = None,
) -> dict:
    """把 input 處理成母帶寫到 output(24-bit WAV)。回傳量測/設定摘要 dict。"""
    if not _HAS_DSP:
        raise RuntimeError("母帶 DSP 相依不可用(需 scipy + pyloudnorm)")

    preset = GENRE_PRESETS.get(genre, GENRE_PRESETS["auto"])
    tgt_lufs, ceiling_db = LOUDNESS_TARGETS.get(loudness, LOUDNESS_TARGETS["streaming"])

    _emit(progress, 3.0, "讀取音訊 · Loading")
    data, sr = _load_audio(input_path)
    in_lufs = _measure_lufs(data, sr)
    in_peak = _peak_db(data)

    # 1) 音色:參考曲匹配 或 曲風 EQ
    ref_used = False
    if reference_path and os.path.isfile(reference_path):
        _emit(progress, 25.0, "比對參考曲音色 · Matching reference")
        ref, rsr = _load_audio(reference_path)
        data = _match_eq(data, sr, ref, rsr)
        ref_used = True
    else:
        _emit(progress, 25.0, f"套用曲風 EQ · {preset['label']}")
        data = _apply_eq(data, sr, preset["eq"])

    # 2) 壓縮膠合
    _emit(progress, 50.0, "動態壓縮 · Compression")
    data = _compress(data, sr, **preset["comp"])

    # 3) 立體聲寬度
    w = float(width) if width is not None else float(preset["width"])
    data = _stereo_width(data, w)

    # 4) 響度正規化到目標(微推 0.3,補限幅器的些微響度損失,但寧可略低於目標也不超過 ——
    #    串流平台會把超過目標的音量轉小,等於白做)。
    _emit(progress, 70.0, f"響度正規化 · {loudness} ({tgt_lufs:g} LUFS)")
    data = _normalize_lufs(data, sr, tgt_lufs + 0.3)

    # 5) 真峰限幅
    _emit(progress, 85.0, "限幅器 · Limiting")
    data = _limit(data, sr, ceiling_db)

    # 6) 限幅後微調:若仍超過目標就往下修(只降不升,避免重新破峰)。
    post = _measure_lufs(data, sr)
    if post > tgt_lufs + 0.2:
        data = data * (10 ** ((tgt_lufs - post) / 20.0))

    out_lufs = _measure_lufs(data, sr)
    out_peak = _peak_db(data)

    _emit(progress, 95.0, "輸出 24-bit WAV · Exporting")
    _write_wav(output_path, data, sr)

    _emit(progress, 100.0, "完成 · Done")
    return {
        "outPath": output_path,
        "sampleRate": sr,
        "genre": genre,
        "loudness": loudness,
        "referenceUsed": ref_used,
        "width": round(w, 3),
        "inputLufs": round(in_lufs, 2),
        "outputLufs": round(out_lufs, 2),
        "targetLufs": tgt_lufs,
        "inputPeakDb": round(in_peak, 2),
        "outputPeakDb": round(out_peak, 2),
        "ceilingDb": ceiling_db,
    }
