"""字幕／歌詞匯出模組 (export formatters).

將管線產生的 ``Result`` 物件轉換為各種常見格式：

* ``to_lrc``  -> LRC（行級 ``[mm:ss.xx]`` 或加強型逐字 ``<mm:ss.xx>``）
* ``to_srt``  -> SubRip 標準字幕
* ``to_vtt``  -> WebVTT 字幕（``HH:MM:SS.mmm``，小數點而非逗號）
* ``to_ass``  -> Advanced SubStation Alpha，含卡拉OK ``{\\kNN}`` 標籤
* ``to_json`` -> 美化後的 Result JSON

字幕模式（``subtitle=True``）：``to_srt`` / ``to_vtt`` 會先用 ``wrap_cues`` 依字數、
時長、CPS（每秒字元數）把過長段落切成多個 cue，並把每個 cue 折成至多兩行平衡的
影片字幕。``subtitle=False``（預設）維持歌詞模式原樣輸出，逐字不更動。

全部使用純標準函式庫，且對殘缺／空白輸入採容錯處理，
絕不因單一段落異常而拋出例外（graceful degradation）。

``Result`` 形狀（見 API_CONTRACT）::

    {
      "language": str,
      "modeUsed": "auto"|"biasing"|"align",
      "segments": [
        { "id": int, "start": float, "end": float, "text": str,
          "words": [ { "start": float, "end": float, "word": str, "prob": float } ] }
      ],
      "meta": { "modelSize": str, "separated": bool, "durationSec": float, "engine": str }
    }
"""

from __future__ import annotations

import json
from typing import Any, Iterable, Optional

__all__ = ["to_lrc", "to_srt", "to_vtt", "to_ass", "to_json", "wrap_cues"]


# ---------------------------------------------------------------------------
# 內部工具函式 (internal helpers)
# ---------------------------------------------------------------------------

def _safe_float(value: Any, default: float = 0.0) -> float:
    """盡量將任意值轉成 float；失敗或為 None/NaN 時回傳 default。"""
    try:
        if value is None:
            return default
        f = float(value)
        # 過濾 NaN / inf（NaN != NaN 為 True）
        if f != f or f in (float("inf"), float("-inf")):
            return default
        return f
    except (TypeError, ValueError):
        return default


def _clamp_nonneg(value: float) -> float:
    """時間不可為負。"""
    return value if value > 0.0 else 0.0


def _segments(result: dict | None) -> list[dict]:
    """安全取出 segments 清單。"""
    if not isinstance(result, dict):
        return []
    segs = result.get("segments")
    if not isinstance(segs, list):
        return []
    return [s for s in segs if isinstance(s, dict)]


def _words(seg: dict) -> list[dict]:
    """安全取出某段落的 words 清單。"""
    words = seg.get("words")
    if not isinstance(words, list):
        return []
    return [w for w in words if isinstance(w, dict)]


def _word_text(w: dict) -> str:
    """取得詞文字（容忍 'word' 或 'text' 欄位）。"""
    txt = w.get("word")
    if txt is None:
        txt = w.get("text")
    return "" if txt is None else str(txt)


def _seg_text(seg: dict) -> str:
    """取得段落文字；若無 text 欄位則由 words 重組。"""
    txt = seg.get("text")
    if txt is not None and str(txt).strip():
        return str(txt)
    # 退而求其次：由逐字拼回
    parts = [_word_text(w) for w in _words(seg)]
    return "".join(parts)


def _fmt_lrc_time(seconds: float) -> str:
    """LRC 時間標籤 ``mm:ss.xx``（百分之一秒，2 位）。

    分鐘不補零上限（>99 分仍正確顯示），秒與百分秒固定 2 位。
    """
    s = _clamp_nonneg(_safe_float(seconds))
    centi_total = int(round(s * 100.0))
    minutes, rem = divmod(centi_total, 60 * 100)
    secs, centi = divmod(rem, 100)
    return f"{minutes:02d}:{secs:02d}.{centi:02d}"


def _fmt_srt_time(seconds: float) -> str:
    """SRT 時間 ``HH:MM:SS,mmm``（毫秒，逗號分隔）。"""
    s = _clamp_nonneg(_safe_float(seconds))
    ms_total = int(round(s * 1000.0))
    hours, rem = divmod(ms_total, 3600 * 1000)
    minutes, rem = divmod(rem, 60 * 1000)
    secs, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _fmt_vtt_time(seconds: float) -> str:
    """WebVTT 時間 ``HH:MM:SS.mmm``（毫秒，**小數點**分隔，與 SRT 的逗號不同）。"""
    s = _clamp_nonneg(_safe_float(seconds))
    ms_total = int(round(s * 1000.0))
    hours, rem = divmod(ms_total, 3600 * 1000)
    minutes, rem = divmod(rem, 60 * 1000)
    secs, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def _fmt_ass_time(seconds: float) -> str:
    """ASS 時間 ``H:MM:SS.cc``（百分秒，1 位小時）。"""
    s = _clamp_nonneg(_safe_float(seconds))
    centi_total = int(round(s * 100.0))
    hours, rem = divmod(centi_total, 3600 * 100)
    minutes, rem = divmod(rem, 60 * 100)
    secs, centi = divmod(rem, 100)
    return f"{hours:d}:{minutes:02d}:{secs:02d}.{centi:02d}"


def _sorted_segments(result: dict | None) -> list[dict]:
    """依 start 時間排序的段落（穩定排序，缺值視為 0）。"""
    segs = _segments(result)
    return sorted(segs, key=lambda s: _safe_float(s.get("start")))


def _ass_escape(text: str) -> str:
    """ASS 內容跳脫：去除換行、保護大括號避免被當成覆寫標籤。"""
    if not text:
        return ""
    # ASS 以反斜線啟動覆寫；換行用 \N。將實際換行轉為硬換行。
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", r"\N")
    # 裸大括號會破壞 override 區塊，轉成全形以保留視覺
    text = text.replace("{", "｛").replace("}", "｝")
    return text


# ---------------------------------------------------------------------------
# 字幕整形 (subtitle cue shaping) — wrap_cues 與相關工具
#
# 影片字幕（SRT / WebVTT）有不成文但被廣泛遵循的可讀性慣例：一個 cue 通常
# ≤2 行、每行字數有限（拉丁文 ~42、CJK ~18）、停留時間不過長（~7s）、閱讀
# 速度（每秒字元數 CPS）不過快（~17）。歌詞模式刻意「一句一段、保留斷行」，
# 因此這套整形只在 subtitle=True 時套用，預設完全不動原段落。
#
# 本區塊全部防禦式撰寫：任何意外都回退到「原段落不切不折」，永不拋例外。
# ---------------------------------------------------------------------------

# CJK / 全形字元的 Unicode 區段（用來決定該段以「字」還是「詞」計寬、以及斷行策略）。
_CJK_RANGES: tuple[tuple[int, int], ...] = (
    (0x3000, 0x303F),   # CJK 標點符號
    (0x3040, 0x30FF),   # 平假名 + 片假名
    (0x3400, 0x4DBF),   # CJK 擴充 A
    (0x4E00, 0x9FFF),   # CJK 統一表意文字
    (0xF900, 0xFAFF),   # CJK 相容表意文字
    (0xFF00, 0xFFEF),   # 全形字母／半形片假名
    (0xAC00, 0xD7A3),   # 韓文音節
)

# 句末 / 句中標點：切 cue 時優先在這些位置斷開（句末權重高於句中）。
_HARD_PUNCT = "。！？!?…"          # 句末（強）
_SOFT_PUNCT = "，、,;；：:）)】」』"  # 句中（弱）


def _is_cjk_char(ch: str) -> bool:
    """判斷單一字元是否落在 CJK / 全形區段。"""
    if not ch:
        return False
    cp = ord(ch)
    for lo, hi in _CJK_RANGES:
        if lo <= cp <= hi:
            return True
    return False


def _is_cjk_text(text: str) -> bool:
    """文字是否「以 CJK 為主」：CJK 字元占非空白字元的多數即視為 CJK。"""
    cjk = 0
    total = 0
    for ch in text:
        if ch.isspace():
            continue
        total += 1
        if _is_cjk_char(ch):
            cjk += 1
    if total == 0:
        return False
    return cjk * 2 >= total  # >= 50%


def _visual_len(text: str) -> int:
    """估算顯示寬度（字元數）。此處 CJK 與拉丁皆以 1 計，由各自的 budget 控制上限。"""
    return len(text.strip())


def _norm_word(w: dict) -> Optional[dict]:
    """把一個 word dict 正規化成 {start,end,word}；無效則回 None。"""
    txt = _word_text(w)
    if txt is None:
        return None
    start = _safe_float(w.get("start"))
    end = _safe_float(w.get("end"), start)
    if end < start:
        end = start
    return {"start": start, "end": end, "word": str(txt)}


def _seg_words_norm(seg: dict) -> list[dict]:
    """取出並正規化某段落可用的 words（過濾全空白詞但保留間距資訊）。"""
    out: list[dict] = []
    for w in _words(seg):
        nw = _norm_word(w)
        if nw is None:
            continue
        out.append(nw)
    return out


def _join_words(words: list[dict], cjk: bool) -> str:
    """把一串 word 拼回文字。CJK 直接相接，拉丁以空白分隔（並修整多餘空白）。"""
    if cjk:
        text = "".join(w["word"] for w in words)
    else:
        # word 本身可能已含前導空白（faster-whisper 慣例）；先 strip 再以單一空白接。
        parts = [w["word"].strip() for w in words]
        text = " ".join(p for p in parts if p != "")
    return " ".join(text.split()) if not cjk else text.strip()


def _make_cue(words: list[dict], cjk: bool) -> Optional[dict]:
    """由一串 word 組出一個 cue（segment 形狀）；空則回 None。"""
    real = [w for w in words if str(w.get("word", "")).strip() != ""]
    if not real:
        return None
    start = real[0]["start"]
    end = real[-1]["end"]
    if end < start:
        end = start
    text = _join_words(real, cjk)
    if text.strip() == "":
        return None
    return {"start": start, "end": end, "text": text, "words": list(real)}


def _cue_cps(text: str, start: float, end: float) -> float:
    """每秒字元數（characters per second）。時長過小時回大值以強制再切。"""
    n = _visual_len(text)
    dur = end - start
    if dur <= 0.01:
        return float(n) * 100.0 if n > 0 else 0.0
    return float(n) / dur


def _needs_split(cue: dict, *, max_chars: int, max_dur: float, max_cps: float) -> bool:
    """判斷某個 cue 是否超標（字數 / 時長 / CPS 任一超過即需再切）。"""
    text = str(cue.get("text", ""))
    start = _safe_float(cue.get("start"))
    end = _safe_float(cue.get("end"), start)
    if _visual_len(text) > max_chars:
        return True
    if (end - start) > max_dur:
        return True
    if _cue_cps(text, start, end) > max_cps:
        return True
    return False


def _best_split_index(words: list[dict], cjk: bool) -> int:
    """為一串 word 找最佳切點（回傳「切在第 i 個 word 之後」的 i，1..len-1）。

    優先序：靠近中段的句末標點 > 句中標點 > 最大詞間空隙 > 正中央。
    回傳的 index 保證 1 <= i <= len-1（兩側都至少留一個 word）。
    """
    n = len(words)
    if n <= 1:
        return n  # 不可切
    mid = n / 2.0

    def _score_punct(i: int, punct: str) -> Optional[float]:
        # words[i-1] 以某標點結尾 → 適合切在其後。回傳「離中段距離」（越小越好）。
        tail = words[i - 1]["word"].strip()
        if tail and tail[-1] in punct:
            return abs(i - mid)
        return None

    # 1) 句末標點
    best_i = -1
    best_d = float("inf")
    for i in range(1, n):
        d = _score_punct(i, _HARD_PUNCT)
        if d is not None and d < best_d:
            best_d, best_i = d, i
    if best_i > 0:
        return best_i

    # 2) 句中標點
    best_i, best_d = -1, float("inf")
    for i in range(1, n):
        d = _score_punct(i, _SOFT_PUNCT)
        if d is not None and d < best_d:
            best_d, best_i = d, i
    if best_i > 0:
        return best_i

    # 3) 最大詞間空隙（靠近中段者優先）
    best_i, best_score = -1, float("-inf")
    for i in range(1, n):
        gap = words[i]["start"] - words[i - 1]["end"]
        # 以「空隙大、且靠近中段」綜合評分
        score = gap - 0.02 * abs(i - mid)
        if score > best_score:
            best_score, best_i = score, i
    if best_i > 0 and (words[best_i]["start"] - words[best_i - 1]["end"]) > 0.0:
        return best_i

    # 4) 正中央
    return max(1, int(round(mid)))


def _split_cue_recursive(
    cue: dict,
    cjk: bool,
    *,
    max_chars: int,
    max_dur: float,
    max_cps: float,
    depth: int = 0,
) -> list[dict]:
    """遞迴地把過長 cue 切成多個合規 cue。無逐字資訊或無法再切時，原樣回傳。"""
    if depth > 12:
        return [cue]
    words = [w for w in cue.get("words", []) if isinstance(w, dict)]
    if len(words) <= 1:
        return [cue]
    if not _needs_split(cue, max_chars=max_chars, max_dur=max_dur, max_cps=max_cps):
        return [cue]

    idx = _best_split_index(words, cjk)
    if idx <= 0 or idx >= len(words):
        return [cue]

    left = _make_cue(words[:idx], cjk)
    right = _make_cue(words[idx:], cjk)
    if left is None or right is None:
        return [cue]

    out: list[dict] = []
    out += _split_cue_recursive(
        left, cjk, max_chars=max_chars, max_dur=max_dur, max_cps=max_cps, depth=depth + 1
    )
    out += _split_cue_recursive(
        right, cjk, max_chars=max_chars, max_dur=max_dur, max_cps=max_cps, depth=depth + 1
    )
    return out


def _wrap_text_lines(text: str, cjk: bool, *, max_chars: int, max_lines: int) -> str:
    """把單一 cue 的文字折成至多 ``max_lines`` 行平衡的字幕行（以 ``\\n`` 連接）。

    拉丁文以「詞」為斷點且力求兩行均衡；CJK 以「字」為斷點，優先在標點後折。
    若仍超出，盡力而為但不丟失任何字元。
    """
    text = " ".join(text.split()) if not cjk else text.strip()
    if text == "":
        return ""
    if _visual_len(text) <= max_chars or max_lines <= 1:
        return text

    if not cjk:
        return _wrap_latin(text, max_chars=max_chars, max_lines=max_lines)
    return _wrap_cjk(text, max_chars=max_chars, max_lines=max_lines)


def _wrap_latin(text: str, *, max_chars: int, max_lines: int) -> str:
    """拉丁文：以空白分詞，貪婪填行，但對兩行情境做均衡優化。"""
    words = text.split()
    if not words:
        return text

    # 兩行時嘗試找最均衡的切點（兩行皆 <= max_chars，且長度差最小）。
    if max_lines == 2:
        best = None
        best_diff = None
        for i in range(1, len(words)):
            l1 = " ".join(words[:i])
            l2 = " ".join(words[i:])
            if len(l1) <= max_chars and len(l2) <= max_chars:
                diff = abs(len(l1) - len(l2))
                if best_diff is None or diff < best_diff:
                    best_diff, best = diff, (l1, l2)
        if best is not None:
            return best[0] + "\n" + best[1]

    # 一般情形：貪婪填行，最多 max_lines 行。
    lines: list[str] = []
    cur = ""
    for w in words:
        cand = w if cur == "" else cur + " " + w
        if len(cand) <= max_chars or cur == "":
            cur = cand
        else:
            lines.append(cur)
            cur = w
            if len(lines) >= max_lines - 1:
                # 最後一行：把剩下的詞全部塞進去（不再折，避免丟字）。
                rest_idx = words.index(w)
                cur = " ".join(words[rest_idx:])
                break
    if cur:
        lines.append(cur)
    return "\n".join(lines[:max_lines]) if lines else text


def _wrap_cjk(text: str, *, max_chars: int, max_lines: int) -> str:
    """CJK：以字為單位。兩行時優先在「中段附近的標點後」折，否則取中點。"""
    chars = list(text)
    n = len(chars)
    if n <= max_chars or max_lines <= 1:
        return text

    if max_lines == 2:
        # 容許的切點範圍：兩行都不超過 max_chars。
        lo = max(1, n - max_chars)
        hi = min(n - 1, max_chars)
        if lo > hi:
            # 無法兩行容下 → 取中點硬折（盡力而為，不丟字）。
            cut = n // 2
            return "".join(chars[:cut]) + "\n" + "".join(chars[cut:])
        mid = n / 2.0
        # 在 [lo, hi] 內找最靠近中段、且其前一字為標點的切點。
        best_cut = None
        best_d = float("inf")
        for cut in range(lo, hi + 1):
            prev = chars[cut - 1]
            if prev in _HARD_PUNCT or prev in _SOFT_PUNCT:
                d = abs(cut - mid)
                if d < best_d:
                    best_d, best_cut = d, cut
        if best_cut is None:
            # 無標點可依 → 取範圍內最接近中點者。
            best_cut = min(range(lo, hi + 1), key=lambda c: abs(c - mid))
        return "".join(chars[:best_cut]) + "\n" + "".join(chars[best_cut:])

    # 多行：等寬切（每行 max_chars），最多 max_lines 行。
    lines = ["".join(chars[i:i + max_chars]) for i in range(0, n, max_chars)]
    return "\n".join(lines[:max_lines])


def wrap_cues(
    segments: Iterable[dict],
    *,
    max_chars_latin: int = 42,
    max_chars_cjk: int = 18,
    max_lines: int = 2,
    max_dur: float = 7.0,
    min_gap: float = 0.08,
    max_cps: float = 17.0,
) -> list[dict]:
    """把辨識段落整形為符合影片字幕慣例的 cue 清單。

    對每個段落：
      1. 依「文字是否以 CJK 為主」選用對應的字數 budget（CJK ~18 / 拉丁 ~42）。
      2. 用逐字時間在自然邊界（句末/句中標點 → 詞間空隙 → 中點）把過長、
         過久（> ``max_dur``）或過快（CPS > ``max_cps``）的段落切成多個 cue。
      3. 每個 cue 折成至多 ``max_lines`` 行、每行不超過字數 budget 的平衡字幕。
      4. 對相鄰 cue 之間施加最小間隙 ``min_gap`` 秒，避免字幕黏連閃爍。

    防禦性：任何段落若無逐字資訊或處理中出現異常，**原樣保留**該段落，
    絕不拋出例外、也不會丟失文字。回傳新的 segment 清單（不修改輸入）。

    Args:
        segments: 來源段落清單（Result.segments 形狀）。
        max_chars_latin: 拉丁文每行字數上限。
        max_chars_cjk: CJK 每行字數上限。
        max_lines: 每個 cue 最多行數（通常 2）。
        max_dur: 單一 cue 最長停留秒數。
        min_gap: 相鄰 cue 之間的最小間隙（秒）。
        max_cps: 每秒字元數上限（閱讀速度）。

    Returns:
        新的 segment 清單，每個元素具備 ``start`` / ``end`` / ``text`` /
        ``words``（text 內可能含 ``\\n`` 代表字幕換行）。
    """
    out: list[dict] = []
    try:
        seg_list = [s for s in segments if isinstance(s, dict)]
    except TypeError:
        return out

    for seg in seg_list:
        try:
            base_start = _safe_float(seg.get("start"))
            base_end = _safe_float(seg.get("end"), base_start)
            if base_end < base_start:
                base_end = base_start
            text = _seg_text(seg)
            cjk = _is_cjk_text(text)
            max_chars = max_chars_cjk if cjk else max_chars_latin

            words = _seg_words_norm(seg)
            if words:
                base_cue = _make_cue(words, cjk)
            else:
                base_cue = None

            if base_cue is None:
                # 無逐字資訊：保留原段落（僅折行，不切分）。
                wrapped = _wrap_text_lines(
                    text, cjk, max_chars=max_chars, max_lines=max_lines
                )
                out.append(
                    {
                        "start": base_start,
                        "end": base_end,
                        "text": wrapped if wrapped else text.strip(),
                        "words": _words(seg),
                    }
                )
                continue

            pieces = _split_cue_recursive(
                base_cue,
                cjk,
                max_chars=max_chars * max_lines,  # 整個 cue 容量 = 行寬 × 行數
                max_dur=max_dur,
                max_cps=max_cps,
            )
            for piece in pieces:
                wrapped = _wrap_text_lines(
                    str(piece.get("text", "")),
                    cjk,
                    max_chars=max_chars,
                    max_lines=max_lines,
                )
                out.append(
                    {
                        "start": _safe_float(piece.get("start")),
                        "end": _safe_float(piece.get("end")),
                        "text": wrapped if wrapped else str(piece.get("text", "")).strip(),
                        "words": piece.get("words", []),
                    }
                )
        except Exception:
            # 任一段落整形失敗 → 原樣保留，絕不中斷整體匯出。
            out.append(
                {
                    "start": _safe_float(seg.get("start")),
                    "end": _safe_float(seg.get("end"), _safe_float(seg.get("start"))),
                    "text": _seg_text(seg).strip(),
                    "words": _words(seg),
                }
            )

    # --- 套用最小間隙：把相鄰 cue 的邊界推開 min_gap，並保持單調不重疊 ---
    try:
        _enforce_min_gap(out, min_gap)
    except Exception:
        pass

    return out


def _enforce_min_gap(cues: list[dict], min_gap: float) -> None:
    """就地調整：確保相鄰 cue 之間至少有 ``min_gap`` 秒、且時間單調不重疊。

    只在「下一個 cue 起點 < 前一個 cue 終點 + min_gap」時把前一個 cue 的終點往前收，
    收到不早於其起點為止（極端情況保留極小正時長），避免播放器忽略或閃爍。
    """
    if min_gap <= 0:
        return
    for i in range(len(cues) - 1):
        cur = cues[i]
        nxt = cues[i + 1]
        cur_start = _safe_float(cur.get("start"))
        cur_end = _safe_float(cur.get("end"), cur_start)
        nxt_start = _safe_float(nxt.get("start"), cur_end)
        if nxt_start - cur_end < min_gap:
            new_end = nxt_start - min_gap
            if new_end < cur_start:
                new_end = cur_start  # 不可早於自身起點
            cur["end"] = new_end


# ---------------------------------------------------------------------------
# LRC
# ---------------------------------------------------------------------------

def to_lrc(result: dict, level: str = "line") -> str:
    """匯出 LRC 歌詞。

    Args:
        result: Result 物件。
        level: ``"line"`` 行級時間標籤；``"word"`` 加強型逐字標籤
               （每個詞前置 ``<mm:ss.xx>``，相容多數加強型 LRC 播放器）。

    Returns:
        LRC 文字（以 ``\\n`` 分行）。空輸入回傳空字串。
    """
    lines: list[str] = []
    want_word = str(level).lower() == "word"

    for seg in _sorted_segments(result):
        start = _safe_float(seg.get("start"))
        tag = f"[{_fmt_lrc_time(start)}]"

        if want_word:
            words = _words(seg)
            if words:
                pieces: list[str] = []
                for w in words:
                    wt = _word_text(w)
                    if wt == "":
                        continue
                    wstart = _safe_float(w.get("start"), start)
                    pieces.append(f"<{_fmt_lrc_time(wstart)}>{wt}")
                # 行尾再放結束時間，方便播放器收尾
                end = _safe_float(seg.get("end"), start)
                body = "".join(pieces) if pieces else _seg_text(seg).strip()
                line = f"{tag}{body}<{_fmt_lrc_time(end)}>" if pieces else f"{tag}{body}"
                lines.append(line)
                continue
            # 無逐字資訊 -> 退回行級
        text = _seg_text(seg).strip()
        lines.append(f"{tag}{text}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# SRT
# ---------------------------------------------------------------------------

def _subtitle_segments(result: dict) -> list[dict]:
    """取得「字幕模式」用的 cue 清單：先 wrap_cues 整形，再依 start 排序。

    任何整形異常都回退到未整形的排序段落，確保 SRT/VTT 永遠有輸出。
    """
    try:
        cues = wrap_cues(_segments(result))
    except Exception:
        cues = _segments(result)
    return sorted(cues, key=lambda s: _safe_float(s.get("start")))


def to_srt(result: dict, subtitle: bool = False) -> str:
    """匯出 SubRip (.srt) 標準字幕。

    區塊格式::

        1
        00:00:01,000 --> 00:00:04,000
        歌詞文字

    以空白行分隔，索引從 1 起算（依 start 排序）。

    Args:
        result: Result 物件。
        subtitle: 若為 True，先用 ``wrap_cues`` 把過長段落切分並折成至多兩行的
            影片字幕 cue（影片→字幕模式）。預設 False 維持歌詞模式逐字輸出，
            **不更動** 既有歌曲模式的 SRT（位元組層級不回歸）。
    """
    segs = _subtitle_segments(result) if subtitle else _sorted_segments(result)
    blocks: list[str] = []
    idx = 1
    for seg in segs:
        start = _safe_float(seg.get("start"))
        end = _safe_float(seg.get("end"), start)
        # 結束不得早於開始，至少給予極小正時長避免播放器忽略
        if end < start:
            end = start
        text = _seg_text(seg).replace("\r\n", "\n").replace("\r", "\n").strip()
        if text == "" and not _words(seg):
            # 完全空白段落仍輸出（保留時間軸），但給空文字
            text = ""
        block = (
            f"{idx}\n"
            f"{_fmt_srt_time(start)} --> {_fmt_srt_time(end)}\n"
            f"{text}"
        )
        blocks.append(block)
        idx += 1
    # SRT 慣例：區塊間空行，檔尾換行
    return ("\n\n".join(blocks) + "\n") if blocks else ""


# ---------------------------------------------------------------------------
# WebVTT
# ---------------------------------------------------------------------------

def to_vtt(result: dict, level: str = "line", subtitle: bool = False) -> str:
    """匯出 WebVTT (.vtt) 字幕。

    結構：首行 ``WEBVTT`` + 空行，接著各 cue。時間格式為 ``HH:MM:SS.mmm``
    （毫秒，以**小數點**分隔，與 SRT 的逗號不同）。

    Args:
        result: Result 物件。
        level: 保留參數以對齊其他匯出器簽章；目前 VTT 僅輸出行級文字（"line"）。
        subtitle: 若為 True，先用 ``wrap_cues`` 把段落整形為至多兩行的影片字幕 cue。
            預設 False 直接以排序後段落逐句輸出。

    Returns:
        WebVTT 文字。即使無段落也回傳合法的 ``"WEBVTT\\n"`` 標頭。
    """
    segs = _subtitle_segments(result) if subtitle else _sorted_segments(result)
    parts: list[str] = ["WEBVTT", ""]
    for seg in segs:
        start = _safe_float(seg.get("start"))
        end = _safe_float(seg.get("end"), start)
        if end < start:
            end = start
        text = _seg_text(seg).replace("\r\n", "\n").replace("\r", "\n").strip()
        cue = (
            f"{_fmt_vtt_time(start)} --> {_fmt_vtt_time(end)}\n"
            f"{text}"
        )
        parts.append(cue)
        parts.append("")  # cue 之間空行
    # 以 \n 連接；標頭後與每個 cue 後皆有空行，符合 WebVTT 規範。
    return "\n".join(parts).rstrip("\n") + "\n"


# ---------------------------------------------------------------------------
# ASS
# ---------------------------------------------------------------------------

_ASS_HEADER = """[Script Info]
; Script generated by AutoLyrics
Title: AutoLyrics Export
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,72,&H00FFFFFF,&H0000FFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,3,1,2,40,40,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""


def to_ass(result: dict, karaoke: bool = True) -> str:
    """匯出 Advanced SubStation Alpha (.ass) 字幕。

    含完整 ``[Script Info]`` / ``[V4+ Styles]`` / ``[Events]`` 標頭。

    Args:
        result: Result 物件。
        karaoke: 若為 True 且段落含逐字時間，於每個詞前置 ``{\\kNN}``，
                 NN 為該詞「持續時間」的百分之一秒（centiseconds），
                 符合 ASS 卡拉OK 規範。否則輸出純文字 Dialogue。

    Returns:
        完整 ASS 檔文字。
    """
    out: list[str] = [_ASS_HEADER]

    for seg in _sorted_segments(result):
        start = _safe_float(seg.get("start"))
        end = _safe_float(seg.get("end"), start)
        if end < start:
            end = start

        text_field = ""
        words = _words(seg) if karaoke else []

        if karaoke and words:
            pieces: list[str] = []
            # 卡拉OK 的每個音節時長以「該詞 end - 詞 start」計，
            # 詞間空隙併入下一個詞的 \k 前，使時間軸連續。
            prev_end = start
            for w in words:
                wt = _ass_escape(_word_text(w))
                wstart = _safe_float(w.get("start"), prev_end)
                wend = _safe_float(w.get("end"), wstart)
                if wend < wstart:
                    wend = wstart
                # 將前一詞結束到本詞開始的空隙，以無字音節吸收，保持同步
                gap_cs = int(round((wstart - prev_end) * 100.0))
                if gap_cs > 0:
                    pieces.append(f"{{\\k{gap_cs}}}")
                dur_cs = int(round((wend - wstart) * 100.0))
                if dur_cs < 0:
                    dur_cs = 0
                pieces.append(f"{{\\k{dur_cs}}}{wt}")
                prev_end = wend
            text_field = "".join(pieces)
            if text_field == "":
                text_field = _ass_escape(_seg_text(seg).strip())
        else:
            text_field = _ass_escape(_seg_text(seg).strip())

        out.append(
            "Dialogue: 0,"
            f"{_fmt_ass_time(start)},{_fmt_ass_time(end)},"
            f"Default,,0,0,0,,{text_field}"
        )

    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------

def to_json(result: dict) -> str:
    """將 Result 物件輸出為美化後的 JSON 字串（UTF-8，保留中文）。

    對非 dict 輸入仍以容錯方式序列化，絕不拋例外。
    """
    try:
        return json.dumps(result, ensure_ascii=False, indent=2)
    except (TypeError, ValueError):
        # 退而求其次：盡量序列化可序列化部分
        try:
            return json.dumps(_coerce_jsonable(result), ensure_ascii=False, indent=2)
        except Exception:  # pragma: no cover - 最終保底
            return "{}"


def _coerce_jsonable(obj: Any) -> Any:
    """遞迴將物件轉為可 JSON 序列化形式（保底用）。"""
    if isinstance(obj, dict):
        return {str(k): _coerce_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_coerce_jsonable(v) for v in obj]
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)
