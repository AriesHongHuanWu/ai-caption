"""作曲輔助(Compose helpers)—— 把偵測到的調性變成「可以照彈/照寫」的音樂資訊:
音階、順階和弦(三和弦 + 七和弦)、常用和弦進行、借用和弦,以及依 BPM 產生的節拍器 click。

License-clean:純音樂理論查表(無音訊)+ numpy 合成 click。給在 beat 上寫 topline/和聲的人。
"""

from __future__ import annotations

import io
from typing import Any

import numpy as np

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# 較好讀的同音異名(小調/降號調用 flat 比較自然)。只做顯示用。
_FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

# 音階(半音間隔)
_MAJOR = [0, 2, 4, 5, 7, 9, 11]
_MINOR = [0, 2, 3, 5, 7, 8, 10]   # 自然小調

# 順階三和弦品質(大調 / 小調)
_TRIAD_MAJ = ["maj", "min", "min", "maj", "maj", "min", "dim"]
_TRIAD_MIN = ["min", "dim", "maj", "min", "min", "maj", "maj"]
_SEVENTH_MAJ = ["maj7", "m7", "m7", "maj7", "7", "m7", "m7b5"]
_SEVENTH_MIN = ["m7", "m7b5", "maj7", "m7", "m7", "maj7", "7"]
_ROMAN_MAJ = ["I", "ii", "iii", "IV", "V", "vi", "vii°"]
_ROMAN_MIN = ["i", "ii°", "III", "iv", "v", "VI", "VII"]

_QUALITY_SUFFIX = {"maj": "", "min": "m", "dim": "dim", "aug": "+",
                   "maj7": "maj7", "m7": "m7", "7": "7", "m7b5": "m7♭5"}

# 常用和弦進行(以級數表示;前端依調性算實際和弦)
_PROG_MAJ = [
    {"name": "Pop / 抒情", "degrees": ["I", "V", "vi", "IV"]},
    {"name": "Doo-wop / 50s", "degrees": ["I", "vi", "IV", "V"]},
    {"name": "Sad / 情緒", "degrees": ["vi", "IV", "I", "V"]},
    {"name": "Jazz ii-V-I", "degrees": ["ii", "V", "I"]},
]
_PROG_MIN = [
    {"name": "Emo / Trap", "degrees": ["i", "VI", "III", "VII"]},
    {"name": "Dark loop", "degrees": ["i", "VII", "VI", "VII"]},
    {"name": "Minor pop", "degrees": ["i", "iv", "VII", "III"]},
    {"name": "Andalusian", "degrees": ["i", "VII", "VI", "V"]},
]


def _name(idx: int, flats: bool) -> str:
    return (_FLAT_NAMES if flats else _NOTE_NAMES)[idx % 12]


def _chord_name(root_idx: int, quality: str, flats: bool) -> str:
    return _name(root_idx, flats) + _QUALITY_SUFFIX.get(quality, "")


def chords_for_key(tonic: str, mode: str) -> dict[str, Any]:
    """回某調性的音階 + 順階和弦(三/七和弦)+ 常用進行 + 借用和弦。"""
    try:
        t = _NOTE_NAMES.index(tonic)
    except ValueError:
        t = 0
        tonic = "C"
    is_minor = (mode or "major").lower().startswith("min")
    flats = is_minor or tonic in ("F", "A#", "D#", "G#", "C#")  # 顯示用同音異名
    steps = _MINOR if is_minor else _MAJOR
    triads = _TRIAD_MIN if is_minor else _TRIAD_MAJ
    sevenths = _SEVENTH_MIN if is_minor else _SEVENTH_MAJ
    romans = _ROMAN_MIN if is_minor else _ROMAN_MAJ

    scale = [_name(t + s, flats) for s in steps]
    diatonic = []
    for i, s in enumerate(steps):
        ri = (t + s) % 12
        diatonic.append({
            "degree": i + 1,
            "roman": romans[i],
            "triad": _chord_name(ri, triads[i], flats),
            "seventh": _chord_name(ri, sevenths[i], flats),
        })

    def _prog_chords(degs: list[str]) -> list[str]:
        out = []
        for dg in degs:
            for d in diatonic:
                if d["roman"] == dg:
                    out.append(d["triad"])
                    break
        return out

    progs = _PROG_MIN if is_minor else _PROG_MAJ
    progressions = [{"name": p["name"], "roman": " – ".join(p["degrees"]),
                     "chords": " – ".join(_prog_chords(p["degrees"]))} for p in progs]

    # 借用和弦(常見「色彩」音):小調 → 大調 V(和聲小調)、大調 → 小調 iv / ♭VII
    if is_minor:
        borrowed = [
            {"label": "大 V(和聲小調,更有解決感)", "chord": _chord_name((t + 7) % 12, "7", flats)},
            {"label": "♭II(拿坡里)", "chord": _chord_name((t + 1) % 12, "maj", flats)},
        ]
        rel = {"label": "關係大調", "key": f"{_name(t + 3, flats)} major"}
    else:
        borrowed = [
            {"label": "小 iv(借用,憂傷色)", "chord": _chord_name((t + 5) % 12, "min", flats)},
            {"label": "♭VII(混合利底亞)", "chord": _chord_name((t + 10) % 12, "maj", flats)},
        ]
        rel = {"label": "關係小調", "key": f"{_name(t + 9, flats)} minor"}

    return {
        "tonic": tonic, "mode": "minor" if is_minor else "major",
        "scaleName": f"{_name(t, flats)} {'natural minor' if is_minor else 'major'}",
        "scale": scale,
        "diatonic": diatonic,
        "progressions": progressions,
        "borrowed": borrowed,
        "relative": rel,
    }


def click_track(bpm: float, bars: int = 8, beats_per_bar: int = 4,
                sr: int = 44100, count_in: bool = True) -> bytes:
    """產生節拍器 click(WAV bytes)。每拍一聲、每小節第一拍重音;可含一小節 count-in。"""
    import soundfile as sf  # type: ignore
    bpm = float(np.clip(bpm if bpm and bpm > 0 else 120.0, 30.0, 300.0))
    beats_per_bar = int(np.clip(beats_per_bar, 1, 12))
    bars = int(np.clip(bars, 1, 64))
    spb = 60.0 / bpm                          # 每拍秒數
    total_beats = beats_per_bar * (bars + (1 if count_in else 0))
    n = int(np.ceil(total_beats * spb * sr)) + sr // 4
    out = np.zeros(n, dtype=np.float64)

    def _click(freq: float, amp: float) -> np.ndarray:
        d = int(0.035 * sr)
        tt = np.arange(d) / sr
        env = np.exp(-tt * 60.0)
        return amp * np.sin(2.0 * np.pi * freq * tt) * env

    accent = _click(1500.0, 0.9)
    beat = _click(1000.0, 0.55)
    for b in range(int(total_beats)):
        pos = int(b * spb * sr)
        c = accent if (b % beats_per_bar == 0) else beat
        e = min(pos + len(c), n)
        out[pos:e] += c[:e - pos]

    stereo = np.column_stack([out, out])
    stereo = np.clip(stereo, -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, stereo, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()
