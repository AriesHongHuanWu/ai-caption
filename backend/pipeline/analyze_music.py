"""深度歌曲分析(Song Analysis)—— 給藝人/製作人:精準調性 + BPM + 曲式結構
(intro/verse/prechorus/chorus/bridge/outro)+ 全曲 EQ 分布 + 曲風/元素 + 人聲混音建議。

License-clean:只用 numpy / scipy(+ 重用 mastering.py 的 DSP 助手)。**不依賴 librosa /
aubio / madmom**(避免 200–300MB 膨脹 + GPL),所有特徵(chroma / onset / MFCC /
自相似矩陣)都自己手刻,在小筆電上也跑得動(分析用 22.05kHz 單聲道)。

核心管線:
  1. 載入 → 22.05kHz 單聲道 + 一次 STFT(重用於所有特徵)。
  2. 調性:估全域微調(cents)→ 微調修正的 chroma(HPSS-lite 抑制鼓點)→ Krumhansl 24 候選
     相關 → 最佳 + 信心(以與次佳的差距為準)+ 替代(含關係大小調)+ Camelot 輪。
  3. BPM:對數功率頻譜流量 onset 包絡 → 自相關 + 速度先驗(破八度模糊)→ BPM + 信心 + 候選。
  4. 結構:chroma+MFCC+能量特徵 → 餘弦自相似矩陣 → Foote 棋盤核新奇度 → 邊界 → 分群 →
     啟發式標記副歌/主歌/前副歌/橋段/前奏/尾奏(誠實附信心,失敗則退回能量法)。
  5. EQ 分布 / 頻譜 / 傾斜 / 形心 + 曲風(重用 detect_genre)+ 響度 + 元素標籤。
  6. 交給 vocal_advice 產生「依情況」的人聲混音建議庫。
"""

from __future__ import annotations

import logging
from math import gcd
from typing import Any, Callable, Optional

import numpy as np

from . import mastering as M

logger = logging.getLogger("autolyrics.analyze_music")

try:
    import scipy.signal as sps  # type: ignore
    from scipy.fft import dct  # type: ignore
    from scipy.ndimage import median_filter, uniform_filter1d, gaussian_filter1d  # type: ignore
    _HAS = True
except Exception:  # pragma: no cover
    sps = None  # type: ignore
    _HAS = False

_ASR = 22050          # 分析取樣率(夠用又快;調性/速度/結構不需 44.1k)
_NPER = 4096
_HOP = 1024

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_NOTE_ZH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Krumhansl–Schmuckler 調性輪廓(大調 / 小調),相對於主音的 12 音高類權重。
_KR_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KR_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Camelot 輪(和聲混音 / DJ 對曲常用)。鍵:(note, mode)。
_CAMELOT = {
    ("B", "major"): "1B", ("F#", "major"): "2B", ("C#", "major"): "3B", ("G#", "major"): "4B",
    ("D#", "major"): "5B", ("A#", "major"): "6B", ("F", "major"): "7B", ("C", "major"): "8B",
    ("G", "major"): "9B", ("D", "major"): "10B", ("A", "major"): "11B", ("E", "major"): "12B",
    ("G#", "minor"): "1A", ("D#", "minor"): "2A", ("A#", "minor"): "3A", ("F", "minor"): "4A",
    ("C", "minor"): "5A", ("G", "minor"): "6A", ("D", "minor"): "7A", ("A", "minor"): "8A",
    ("E", "minor"): "9A", ("B", "minor"): "10A", ("F#", "minor"): "11A", ("C#", "minor"): "12A",
}
_MODE_ZH = {"major": "大調", "minor": "小調"}


# --------------------------------------------------------------------------- #
# 低階特徵(一次 STFT,全部重用)
# --------------------------------------------------------------------------- #
def _to_analysis_mono(data: "np.ndarray", sr: int) -> tuple["np.ndarray", int]:
    """轉單聲道並重採樣到 _ASR(用 polyphase,品質好又快)。"""
    mono = np.mean(np.asarray(data, dtype=np.float64), axis=1)
    if sr != _ASR and mono.size > 16:
        g = gcd(int(_ASR), int(sr))
        mono = sps.resample_poly(mono, _ASR // g, sr // g)
    return np.ascontiguousarray(mono, dtype=np.float64), _ASR


def _stft_mag(mono: "np.ndarray") -> tuple["np.ndarray", "np.ndarray"]:
    """magnitude 頻譜圖 → (f[nbins], S[nbins, T])。"""
    f, _t, Z = sps.stft(mono, fs=_ASR, nperseg=_NPER, noverlap=_NPER - _HOP,
                        window="hann", boundary=None, padded=False)
    return f, np.abs(Z).astype(np.float64)


def _hpss_harmonic(S: "np.ndarray") -> "np.ndarray":
    """HPSS-lite:沿時間軸中值濾波 → 強調諧波(抑制鼓點/瞬態),讓 chroma/調性更穩。"""
    if S.shape[1] < 9:
        return S
    return median_filter(S, size=(1, 17), mode="nearest")


def _estimate_tuning_cents(f: "np.ndarray", Smean: "np.ndarray") -> float:
    """估全域微調偏移(cents):把強頻率對等律格點的偏差做能量加權直方圖取峰。"""
    m = (f >= 100.0) & (f <= 4000.0) & (Smean > 0)
    if np.count_nonzero(m) < 8:
        return 0.0
    fm, mag = f[m], Smean[m]
    dev = 12.0 * np.log2(fm / 440.0)
    cents = (dev - np.round(dev)) * 100.0
    hist, edges = np.histogram(cents, bins=50, range=(-50.0, 50.0), weights=mag)
    if not np.any(hist):
        return 0.0
    k = int(np.argmax(hist))
    return float(0.5 * (edges[k] + edges[k + 1]))


def _chroma(f: "np.ndarray", S: "np.ndarray", tuning_cents: float) -> "np.ndarray":
    """12 音高類 chroma 矩陣 (12, T),log 壓縮 + 微調修正,限 100–4000 Hz。"""
    m = (f >= 100.0) & (f <= 4000.0)
    fm, Sm = f[m], np.log1p(S[m])
    pc = np.mod(np.round(69.0 + 12.0 * np.log2(fm / 440.0) + tuning_cents / 100.0).astype(int), 12)
    T = Sm.shape[1]
    chroma = np.zeros((12, T))
    for k in range(12):
        sel = pc == k
        if np.any(sel):
            chroma[k] = Sm[sel].sum(axis=0)
    return chroma


def _detect_key(chroma_mean: "np.ndarray", tuning_cents: float) -> dict:
    """Krumhansl 24 候選相關 → 調性 + 信心 + 替代(含關係調)+ Camelot。"""
    c = chroma_mean - chroma_mean.mean()
    if float(np.std(c)) < 1e-9:
        return {"name": "—", "tonic": "C", "mode": "major", "confidence": 0,
                "camelot": "", "tuningCents": round(tuning_cents), "alternates": []}
    cands: list[tuple[int, str, float]] = []
    for shift in range(12):
        cr = np.roll(chroma_mean, -shift)
        for mode, prof in (("major", _KR_MAJ), ("minor", _KR_MIN)):
            r = float(np.corrcoef(cr, prof)[0, 1])
            if r == r:  # not NaN
                cands.append((shift, mode, r))
    cands.sort(key=lambda x: -x[2])
    if not cands:
        return {"name": "—", "tonic": "C", "mode": "major", "confidence": 0,
                "camelot": "", "tuningCents": round(tuning_cents), "alternates": []}
    bshift, bmode, br = cands[0]
    second = cands[1][2] if len(cands) > 1 else 0.0
    tonic = _NOTE_NAMES[bshift]
    strength = float(np.clip((br + 1.0) / 2.0, 0.0, 1.0))     # 相關 → 0..1
    clarity = float(np.clip((br - second) / 0.30, 0.0, 1.0))  # 與次佳差距
    conf = int(round(100.0 * np.clip(0.45 * strength + 0.55 * clarity, 0.0, 1.0)))
    alts = []
    for sh, md, r in cands[1:6]:
        nm = f"{_NOTE_NAMES[sh]} {md}"
        if nm not in [a["name"] for a in alts]:
            alts.append({"name": nm, "tonic": _NOTE_NAMES[sh], "mode": md,
                         "camelot": _CAMELOT.get((_NOTE_NAMES[sh], md), ""),
                         "score": round(float(r), 3)})
        if len(alts) >= 3:
            break
    return {
        "name": f"{tonic} {bmode}",
        "tonic": tonic, "mode": bmode,
        "camelot": _CAMELOT.get((tonic, bmode), ""),
        "confidence": conf,
        "tuningCents": round(tuning_cents),
        "score": round(br, 3),
        "alternates": alts,
    }


def _onset_env(S: "np.ndarray") -> "np.ndarray":
    """對數功率頻譜流量 onset 包絡(half-wave rectified + 局部均值扣除)。"""
    logS = np.log1p(S)
    flux = np.maximum(0.0, np.diff(logS, axis=1)).sum(axis=0)
    flux = np.concatenate([[0.0], flux])
    flux = flux - uniform_filter1d(flux, size=16, mode="nearest")
    return np.maximum(0.0, flux)


def _estimate_tempo(onset: "np.ndarray", fps: float) -> dict:
    """onset 自相關 + 對數常態速度先驗(中心 120,破八度模糊)→ BPM + 信心 + 候選。"""
    if onset.size < 16:
        return {"bpm": 0.0, "bpmRounded": 0, "confidence": 0, "candidates": []}
    oe = onset - onset.mean()
    ac = np.correlate(oe, oe, "full")[oe.size - 1:]
    ac = ac / (ac[0] + 1e-12)
    bpms = np.arange(50.0, 210.0, 0.5)
    lags = fps * 60.0 / bpms
    idx = np.clip(lags.astype(int), 1, ac.size - 1)
    strength = ac[idx]
    prior = np.exp(-0.5 * (np.log2(bpms / 120.0) / 0.9) ** 2)  # 偏好 ~120 BPM 附近
    score = strength * prior
    best = int(np.argmax(score))
    bpm = float(bpms[best])
    # 信心:該速度處的正規化自相關強度(週期性),映射到 0..1(0.1→0、0.5→1)。
    conf = float(np.clip((strength[best] - 0.1) / 0.4, 0.0, 1.0))
    # 候選:分數的局部極大(含半/倍速)
    cand = []
    for j in range(2, score.size - 2):
        if score[j] > score[j - 1] and score[j] >= score[j + 1]:
            cand.append((float(bpms[j]), float(strength[j])))
    cand.sort(key=lambda x: -x[1])
    seen, out = set(), []
    for b, s in cand:
        rb = round(b)
        if rb not in seen:
            seen.add(rb)
            out.append({"bpm": round(b, 1), "strength": round(s, 3)})
        if len(out) >= 4:
            break
    return {"bpm": round(bpm, 1), "bpmRounded": int(round(bpm)),
            "confidence": int(round(conf * 100)), "candidates": out}


# --------------------------------------------------------------------------- #
# 曲式結構分割
# --------------------------------------------------------------------------- #
def _mel_filterbank(nbins: int, n_mel: int = 24) -> "np.ndarray":
    """三角 mel 濾波器組 (n_mel, nbins),對應 _NPER FFT @ _ASR。"""
    f = np.linspace(0.0, _ASR / 2.0, nbins)
    mel = lambda hz: 2595.0 * np.log10(1.0 + hz / 700.0)
    inv = lambda m: 700.0 * (10.0 ** (m / 2595.0) - 1.0)
    edges = inv(np.linspace(mel(40.0), mel(_ASR / 2.0), n_mel + 2))
    fb = np.zeros((n_mel, nbins))
    for i in range(n_mel):
        lo, ce, hi = edges[i], edges[i + 1], edges[i + 2]
        up = (f - lo) / max(ce - lo, 1e-6)
        dn = (hi - f) / max(hi - ce, 1e-6)
        fb[i] = np.clip(np.minimum(up, dn), 0.0, None)
    return fb


def _frame_features(S: "np.ndarray", chroma: "np.ndarray", f: "np.ndarray",
                    target_fps: float = 2.0) -> tuple["np.ndarray", "np.ndarray", "np.ndarray", float]:
    """聚合到 ~target_fps 的特徵幀:回 (feat[T,d], energy_db[T], vocalness[T], fps_feat)。"""
    fps = _ASR / _HOP
    block = max(1, int(round(fps / target_fps)))
    T = S.shape[1]
    nfr = max(1, T // block)
    # MFCC(mel → log → DCT 前 13)
    fb = _mel_filterbank(S.shape[0])
    melE = np.log(fb @ (S ** 2) + 1e-9)            # (n_mel, T)
    mfcc = dct(melE, type=2, axis=0, norm="ortho")[1:14]  # (13, T)
    rms = np.sqrt(np.mean(S ** 2, axis=0) + 1e-12)
    energy_db = 20.0 * np.log10(rms + 1e-9)
    # 粗略人聲度:200–4000 Hz 能量佔比(相對全頻)
    vb = (f >= 200.0) & (f <= 4000.0)
    voc = S[vb].sum(axis=0) / (S.sum(axis=0) + 1e-9)
    # 音色描述:頻譜形心(亮度)+ 平坦度(噪訊度)—— 讓「編曲/樂器轉換」(獨奏→全團、人聲→鼓點)
    # 在自相似矩陣裡顯現,使段落邊界與分群更準。
    psum = S.sum(axis=0) + 1e-9
    cent = (f[:, None] * S).sum(axis=0) / psum
    flat = np.exp(np.log(S + 1e-9).mean(axis=0)) / (S.mean(axis=0) + 1e-9)

    def _agg(x, axis_last=True):
        x = np.asarray(x)
        if x.ndim == 1:
            return np.array([x[i * block:(i + 1) * block].mean() for i in range(nfr)])
        return np.array([x[:, i * block:(i + 1) * block].mean(axis=1) for i in range(nfr)])  # (nfr, d)

    ch = _agg(chroma)        # (nfr, 12)
    mf = _agg(mfcc)          # (nfr, 13)
    en = _agg(energy_db)     # (nfr,)
    vo = _agg(voc)           # (nfr,)
    ce = _agg(cent)          # (nfr,) 形心
    fl = _agg(flat)          # (nfr,) 平坦度
    # 正規化各特徵塊(z-score)後串接;chroma 加權(和聲重複是結構主訊號),音色特徵權重稍低。
    def _z(a):
        return (a - a.mean(axis=0)) / (a.std(axis=0) + 1e-9)
    feat = np.hstack([1.3 * _z(ch), _z(mf), _z(en)[:, None], 0.7 * _z(ce)[:, None], 0.7 * _z(fl)[:, None]])
    return feat, en, vo, target_fps


def _segment_structure(S: "np.ndarray", chroma: "np.ndarray", f: "np.ndarray",
                       duration_s: float) -> list[dict[str, Any]]:
    """自相似矩陣 → Foote 新奇度 → 邊界 → 分群 → 啟發式標記曲式段。"""
    feat, energy_db, vocalness, fps = _frame_features(S, chroma, f)
    n = feat.shape[0]
    if n < 8 or duration_s < 12.0:
        return []
    # 餘弦自相似矩陣
    norm = feat / (np.linalg.norm(feat, axis=1, keepdims=True) + 1e-9)
    ssm = norm @ norm.T
    # Foote 棋盤核新奇度
    K = max(4, int(round(8.0 * fps)))          # ~8 秒核
    K = min(K, n // 2)
    if K < 2:
        return []
    g = np.outer(*[np.hanning(2 * K)] * 2) if False else None
    ax = np.arange(-K, K)
    gg = np.exp(-0.5 * (np.outer(ax, np.ones(2 * K)) ** 2 + np.outer(np.ones(2 * K), ax) ** 2) / (K * 0.5) ** 2)
    sign = np.sign(np.outer(ax, ax))
    kernel = gg * sign
    novelty = np.zeros(n)
    for i in range(n):
        a, b = i - K, i + K
        if a < 0 or b > n:
            continue
        novelty[i] = float(np.sum(ssm[a:b, a:b] * kernel))
    novelty = np.maximum(0.0, novelty)
    if novelty.max() > 0:
        novelty = novelty / novelty.max()
    novelty = gaussian_filter1d(novelty, sigma=1.0)
    # 邊界:用「突出度(prominence)」挑峰,而非固定門檻 —— 對多模態新奇度(intro→verse 弱、
    # verse→chorus 強)更穩,抓得到弱但真實的邊界,也不被連續高原誤判。最短段 ~7 秒。
    min_gap = max(3, int(round(7.0 * fps)))
    nov_range = float(novelty.max() - novelty.min()) + 1e-9
    peaks, _props = sps.find_peaks(
        novelty, distance=min_gap,
        prominence=max(0.05, 0.16 * nov_range),
        height=float(np.mean(novelty) + 0.25 * np.std(novelty)))
    bounds = [0] + [int(p) for p in peaks] + [n]
    bounds = sorted(set(bounds))
    if len(bounds) < 2:
        return []
    # 段落特徵 → 分群(貪婪,餘弦距離門檻)
    segs = []
    for s, e in zip(bounds[:-1], bounds[1:]):
        if e <= s:
            continue
        fmean = norm[s:e].mean(axis=0)
        segs.append({"s": s, "e": e, "feat": fmean,
                     "energy": float(np.mean(energy_db[s:e])),
                     "voc": float(np.mean(vocalness[s:e])),
                     "dur": (e - s) / fps})
    # 自適應分群門檻:依「段落間相似度分布」調整 —— 結構單一的歌(分布窄)用較低門檻,避免把重複的
    # 主歌硬拆成不同段;結構多變的歌(分布寬)用較高門檻,避免把不同段硬併。
    if len(segs) >= 3:
        sf = np.array([sg["feat"] for sg in segs])
        sfn = sf / (np.linalg.norm(sf, axis=1, keepdims=True) + 1e-9)
        iu = np.triu_indices(len(segs), k=1)
        sim_std = float(np.std((sfn @ sfn.T)[iu])) if iu[0].size else 0.15
        clust_thr = float(np.clip(0.80 + 0.5 * (sim_std - 0.15), 0.70, 0.90))
    else:
        clust_thr = 0.80
    clusters: list[dict] = []
    for sg in segs:
        best_c, best_sim = -1, 0.0
        for ci, cl in enumerate(clusters):
            sim = float(np.dot(sg["feat"], cl["center"]) /
                        (np.linalg.norm(sg["feat"]) * np.linalg.norm(cl["center"]) + 1e-9))
            if sim > best_sim:
                best_sim, best_c = sim, ci
        if best_sim >= clust_thr:
            cl = clusters[best_c]
            cl["members"].append(sg)
            cl["center"] = (cl["center"] * (len(cl["members"]) - 1) + sg["feat"]) / len(cl["members"])
            sg["cluster"] = best_c
        else:
            sg["cluster"] = len(clusters)
            clusters.append({"center": sg["feat"].copy(), "members": [sg]})
    # 標記啟發式
    counts = {ci: len(cl["members"]) for ci, cl in enumerate(clusters)}
    energies = {ci: np.mean([m["energy"] for m in cl["members"]]) for ci, cl in enumerate(clusters)}
    vocs = {ci: np.mean([m["voc"] for m in cl["members"]]) for ci, cl in enumerate(clusters)}
    # 副歌:重複出現(>=2)中能量最高者;若皆不重複,取整體能量最高的長段
    rep = [ci for ci, c in counts.items() if c >= 2]
    if rep:
        chorus_c = max(rep, key=lambda ci: energies[ci] + 0.3 * vocs[ci])
    else:
        chorus_c = max(range(len(clusters)), key=lambda ci: energies[ci])
    med_e = float(np.median([sg["energy"] for sg in segs]))
    labels = []
    first_chorus_idx = next((i for i, sg in enumerate(segs) if sg["cluster"] == chorus_c), len(segs))
    for i, sg in enumerate(segs):
        c = sg["cluster"]
        lab = "verse"
        if c == chorus_c:
            lab = "chorus"
        elif i == 0 and sg["energy"] < med_e - 1.0 and sg["dur"] < 18.0:
            lab = "intro"
        elif i == len(segs) - 1 and sg["energy"] < med_e:
            lab = "outro"
        elif i + 1 < len(segs) and segs[i + 1]["cluster"] == chorus_c and counts[c] == 1 \
                and sg["dur"] < 16.0 and i >= first_chorus_idx:
            lab = "prechorus"
        elif counts[c] == 1 and i > len(segs) * 0.45 and c != chorus_c \
                and sg["voc"] >= 0.25:
            lab = "bridge"
        elif sg["voc"] < 0.22 and sg["energy"] >= med_e:
            lab = "instrumental"
        # 信心:段落特徵與其群中心的相似度
        cl = clusters[c]
        sim = float(np.dot(sg["feat"], cl["center"]) /
                    (np.linalg.norm(sg["feat"]) * np.linalg.norm(cl["center"]) + 1e-9))
        labels.append({
            "start_s": round(sg["s"] / fps, 2),
            "end_s": round(sg["e"] / fps, 2),
            "label": lab,
            "cluster": chr(ord("A") + c),
            "energyDb": round(sg["energy"], 1),
            "confidence": int(round(np.clip(sim, 0.0, 1.0) * 100)),
        })
    return _merge_sections(labels)


def _merge_sections(secs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """併掉相鄰且同標記的段落 → 更乾淨、更像真實曲式(例如把連續 8 段主歌併成一段)。"""
    if not secs:
        return secs
    out = [dict(secs[0])]
    for s in secs[1:]:
        if s["label"] == out[-1]["label"]:
            out[-1]["end_s"] = s["end_s"]
            out[-1]["confidence"] = max(out[-1]["confidence"], s["confidence"])
            out[-1]["energyDb"] = round((out[-1]["energyDb"] + s["energyDb"]) / 2.0, 1)
        else:
            out.append(dict(s))
    return out


# --------------------------------------------------------------------------- #
# 主入口
# --------------------------------------------------------------------------- #
def is_available() -> bool:
    return _HAS and getattr(M, "_HAS_DSP", True)


def analyze_song(path: str, progress: Optional[Callable[[str, float, str], None]] = None) -> dict:
    """整首歌深度分析。回傳 dict(見前端 SongAnalysis 型別)。任一步失敗都安全降級。"""
    if not _HAS:
        raise RuntimeError("歌曲分析 DSP 相依不可用(需 scipy)")

    def _p(stage: str, pct: float, msg: str) -> None:
        if progress:
            try:
                progress(stage, pct, msg)
            except Exception:
                pass

    _p("load", 0.05, "載入音訊")
    data, sr = M._load_audio(path)
    duration_s = float(data.shape[0]) / float(sr) if sr else 0.0
    mono, asr = _to_analysis_mono(data, sr)

    _p("stft", 0.20, "計算頻譜")
    f, S = _stft_mag(mono)
    Smean = S.mean(axis=1)
    fps = asr / _HOP

    # 調性
    _p("key", 0.40, "偵測調性")
    try:
        tuning = _estimate_tuning_cents(f, Smean)
        Sh = _hpss_harmonic(S)
        chroma = _chroma(f, Sh, tuning)
        key = _detect_key(chroma.mean(axis=1), tuning)
    except Exception as exc:
        logger.warning("key detect failed: %s", exc)
        chroma = _chroma(f, S, 0.0)
        key = {"name": "—", "tonic": "C", "mode": "major", "confidence": 0,
               "camelot": "", "tuningCents": 0, "alternates": []}

    # BPM
    _p("tempo", 0.55, "偵測速度")
    try:
        tempo = _estimate_tempo(_onset_env(S), fps)
    except Exception as exc:
        logger.warning("tempo detect failed: %s", exc)
        tempo = {"bpm": 0.0, "bpmRounded": 0, "confidence": 0, "candidates": []}

    # 結構
    _p("structure", 0.70, "分析曲式")
    try:
        sections = _segment_structure(S, chroma, f, duration_s)
    except Exception as exc:
        logger.warning("structure detect failed: %s", exc)
        sections = []
    if not sections:  # 退回能量法(主歌/副歌)
        try:
            times, env_db = M._energy_envelope(mono, asr, hop_s=0.1, win_s=1.5)
            sections = [{"start_s": s["start_s"], "end_s": s["end_s"], "label": s["type"],
                         "cluster": "A" if s["type"] == "verse" else "B",
                         "energyDb": 0.0, "confidence": 40}
                        for s in M._detect_sections(times, env_db, 0.1)]
        except Exception:
            sections = []

    # 曲風 + EQ 分布 + 響度 + 元素(重用 mastering)
    _p("spectral", 0.85, "頻譜 / 曲風 / 響度")
    genre = M.detect_genre(data, sr)
    fa, pxx = M._welch_psd(np.mean(data, axis=1), sr)
    band_db = M._band_levels_db(fa, pxx)
    bmean = float(np.mean(list(band_db.values())))
    bands = [{"name": nm, "centerHz": int(round((lo * hi) ** 0.5)),
              "db": round(band_db[nm] - bmean, 1)} for nm, lo, hi in M._BANDS]
    logf = np.geomspace(20.0, min(20000.0, sr / 2.0 - 1), 96)
    spec = M._spectrum_curve(np.mean(data, axis=1), sr, logf)
    spec = spec - float(np.mean(spec))
    spectrum = [{"f": round(float(x), 1), "db": round(float(y), 2)} for x, y in zip(logf, spec)]
    tilt = M._spectral_tilt(fa, pxx)
    centroid = M._spectral_centroid(fa, pxx)
    # 中間值若非有限(退化輸入:全靜音/DC)→ 後面的元素判斷用 NaN 比較會全部 False(靜默漏判)。
    # 在這裡就夾成安全值,讓 _derive_elements 的門檻判斷正常運作。
    tilt = float(tilt) if np.isfinite(tilt) else -3.2
    centroid = float(centroid) if np.isfinite(centroid) else 0.0
    lufs = M._measure_lufs(data, sr)
    try:
        tp = M._true_peak_dbtp(data, sr)
    except Exception:
        tp = M._peak_db(data)
    peak = float(np.max(np.abs(data))) + 1e-12
    rms = float(np.sqrt(np.mean(data ** 2)) + 1e-12)
    crest = 20.0 * np.log10(peak / rms)
    sib_lo, sib_hi = M._sibilant_band(data, sr)

    elements = _derive_elements(bands, tilt, crest, lufs, genre, sib_lo, sib_hi, fa, pxx, data)

    analysis = {
        "durationS": round(duration_s, 1),
        "sampleRate": int(sr),
        "key": key,
        "tempo": tempo,
        "genre": {"top": genre["genre"], "confidence": int(round(genre["confidence"] * 100)),
                  "ranking": genre["ranking"]},
        "sections": sections,
        "eq": {"bands": bands, "spectrum": spectrum,
               "tiltDbOct": round(float(tilt), 2), "centroidHz": int(round(centroid))},
        "loudness": {"integratedLufs": round(float(lufs), 1), "truePeakDbtp": round(float(tp), 2),
                     "crestDb": round(float(crest), 1)},
        "sibilantHz": [int(round(sib_lo)), int(round(sib_hi))],
        "elements": elements,
    }
    _p("advice", 0.95, "產生混音建議")
    try:
        from . import vocal_advice as VA
        analysis["vocalMix"] = VA.build_advice(analysis)
    except Exception as exc:
        logger.warning("vocal advice failed: %s", exc)
        analysis["vocalMix"] = None
    # 作曲輔助:把偵測到的調性變成音階 + 順階和弦 + 進行(在 beat 上寫 topline/和聲用)。
    try:
        from . import compose as CO
        analysis["compose"] = CO.chords_for_key(key.get("tonic", "C"), key.get("mode", "major"))
    except Exception as exc:
        logger.warning("compose helper failed: %s", exc)
        analysis["compose"] = None
    _p("done", 1.0, "完成")
    return M._finite_scrub(analysis)


def _derive_elements(bands, tilt, crest, lufs, genre, sib_lo, sib_hi, fa, pxx, data) -> list[dict]:
    """從特徵推出可讀的「元素」標籤(描述這首歌的聲音性格)。"""
    bd = {b["name"]: b["db"] for b in bands}
    el: list[dict] = []

    def add(eid, zh, en, detail_zh, detail_en, kind="info"):
        el.append({"id": eid, "label": zh, "labelEn": en,
                   "detail": detail_zh, "detailEn": detail_en, "kind": kind})

    if bd.get("sub", 0) > 2.5:
        add("subheavy", "重低頻", "Sub-heavy", "20–60 Hz 能量偏多,low-end 飽滿。",
            "Lots of 20–60 Hz energy — a big low end.", "info")
    if bd.get("bass", 0) > 2.5:
        add("bassheavy", "厚實貝斯", "Bass-forward", "60–150 Hz 突出。", "Prominent 60–150 Hz.", "info")
    if bd.get("low_mid", 0) > 2.5:
        add("boxy", "中低渾濁", "Boxy / muddy mids", "200–500 Hz 偏多,可能讓人聲混濁。",
            "Built-up 200–500 Hz — vocals may sound boxy.", "warn")
    if tilt > -2.0:
        add("bright", "明亮", "Bright", f"頻譜傾斜 {round(tilt,1)} dB/oct,高頻偏多。",
            f"Spectral tilt {round(tilt,1)} dB/oct — bright top end.", "info")
    elif tilt < -4.2:
        add("dark", "偏暗", "Dark / dull", f"頻譜傾斜 {round(tilt,1)} dB/oct,高頻偏少。",
            f"Spectral tilt {round(tilt,1)} dB/oct — dark / lacking air.", "warn")
    if bd.get("air", 0) > 1.5:
        add("airy", "空氣感", "Airy", "10 kHz 以上充足。", "Plenty above 10 kHz.", "info")
    if crest >= 12.0:
        add("dynamic", "動態大", "Dynamic", f"crest {round(crest,1)} dB,起伏明顯。",
            f"Crest {round(crest,1)} dB — wide dynamics.", "info")
    elif crest <= 7.5:
        add("loud", "壓得響", "Loud / compressed", f"crest {round(crest,1)} dB,動態小、很響。",
            f"Crest {round(crest,1)} dB — loud and compressed.", "info")
    # 齒音判斷
    sm = (fa >= sib_lo) & (fa <= sib_hi)
    sib = float(M._trapz(pxx[sm], fa[sm]) + 1e-12) if np.any(sm) else 1e-12
    tot = float(M._trapz(pxx, fa) + 1e-12)
    if 10.0 * np.log10(sib / tot) > -16.0:
        add("sibilant", "齒音偏多", "Sibilant", f"~{int(round((sib_lo*sib_hi)**0.5))} Hz 齒音明顯。",
            f"Noticeable sibilance near {int(round((sib_lo*sib_hi)**0.5))} Hz.", "warn")
    # 立體聲
    if data.shape[1] >= 2:
        L, R = data[:, 0], data[:, 1]
        mid = float(np.sqrt(np.mean((0.5 * (L + R)) ** 2) + 1e-12))
        side = float(np.sqrt(np.mean((0.5 * (L - R)) ** 2) + 1e-12))
        w = side / (mid + 1e-12)
        if w > 0.6:
            add("wide", "立體聲寬", "Wide stereo", "side 能量高,空間感大。", "Wide stereo image.", "info")
        elif w < 0.2:
            add("narrow", "偏窄/接近單聲", "Narrow / mono-ish", "立體聲偏窄。", "Narrow stereo image.", "info")
    return el
