"""pipeline/romanize.py — 語言感知的 CJK → 拉丁羅馬化(供 MMS_FA 強制對齊)。

為什麼需要這支模組
------------------
torchaudio `MMS_FA` 的字典是純拉丁(a–z + 省略號 `'`,共 29 個 token)。CJK 必須先
羅馬化才能對齊。先前 `align.py` 只用 **uroman**:uroman 是通用 Han→Latin 轉寫器,
對「同一個漢字」不分國語/粵語都輸出相同結果,而且那不是「歌唱發音」。

本模組改成**語言感知**羅馬化:
  - 粵語 (yue) → **jyutping**(pycantonese,詞context消歧;聲調數字事後剝除 → 純 a–z)
  - 國語 (zh) → **pinyin**(pypinyin,`lazy_pinyin`+`Style.NORMAL` 已無聲調,1 字 1 音節)
  - 其他 (含 jpn/kor) → **uroman**(若可用)→ 最後退回原樣(identity)

⚠️ **自動偵測的粵語會用國語 pinyin**:Whisper 無原生粵語,會把粵語歌標成 `zh`,
auto-detect 又傳 None → 對齊端退回 iso3 `zho` → 走 pinyin。要讓粵語走 jyutping,使用者
必須在 UI 明確選「粵語 Cantonese」(forward `lang_code='yue'`),或選 cantopop 風格
preset(其 `lang` 已設為 `'yue'`)。國語 pinyin 套在粵字上音不準,但仍勝過完全不羅馬化。

pinyin / jyutping 剝掉聲調後**本來就落在 MMS_FA 的 a–z 字典內**,且比 uroman 更貼近
實際歌唱發音 —— 這是「幾乎免費」的最大精度提升。

設計原則:**優雅降級**。每個可選套件都在 import 時偵測;缺任何一個都不會讓模組 import
失敗,只是該語言退回下一層。所有對外函式都包 try/except,絕不向上拋。

對外契約
--------
  - HAS_PINYIN / HAS_JYUTPING / HAS_UROMAN : bool 旗標(供 /api/meta 或測試查詢)
  - availability() -> dict[str, bool]
  - romanize_token(text, lang) -> str
        把「單一顯示 token」(可能是一個 CJK 字、也可能是一段 Latin)羅馬化成拉丁字串。
        回傳值尚未過濾到 a–z;呼叫端(align._normalize_token)會做 lower + 去非字母。
  - romanize_line_map(line, lang) -> dict[int, str]
        把「整行」一次羅馬化,回傳 {字元index: 該字的拉丁音節}。
        ★ 用整行(而非逐字)呼叫 pycantonese/pypinyin 才能保留詞context消歧,精度最高。
        align.py 應優先用這個 per-line map,token 級再 fallback 到 romanize_token。
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger("autolyrics.romanize")

# 聲調數字(jyutping 1-6 / pinyin 數字式)以及任何殘留數字一律剝除。
_DIGITS = re.compile(r"[0-9]")

# --------------------------------------------------------------------------- #
# 可選相依偵測(全部 import-time、全部 try/except)
# --------------------------------------------------------------------------- #
HAS_PINYIN = False
try:  # pragma: no cover - 取決於環境
    from pypinyin import lazy_pinyin, Style  # type: ignore

    HAS_PINYIN = True
except Exception:  # noqa: BLE001
    lazy_pinyin = None  # type: ignore
    Style = None  # type: ignore
    HAS_PINYIN = False

HAS_JYUTPING = False
try:  # pragma: no cover - 取決於環境
    import pycantonese  # type: ignore

    HAS_JYUTPING = True
except Exception:  # noqa: BLE001
    pycantonese = None  # type: ignore
    HAS_JYUTPING = False

HAS_UROMAN = False
_UROMAN = None
try:  # pragma: no cover - 取決於環境
    from uroman import Uroman as _Uroman  # type: ignore

    _UROMAN = _Uroman()
    HAS_UROMAN = True
except Exception:  # noqa: BLE001
    _UROMAN = None
    HAS_UROMAN = False

if HAS_PINYIN:
    logger.info("pypinyin 可用 → 國語(zh)逐字 pinyin 對齊。")
if HAS_JYUTPING:
    logger.info("pycantonese 可用 → 粵語(yue)逐字 jyutping 對齊。")
if HAS_UROMAN:
    logger.info("uroman 可用 → 其他 CJK(jpn/kor…)羅馬化後備。")


def availability() -> dict:
    """回傳各羅馬化後端是否可用(供 /api/meta、測試)。"""
    return {
        "pinyin": HAS_PINYIN,
        "jyutping": HAS_JYUTPING,
        "uroman": HAS_UROMAN,
    }


# --------------------------------------------------------------------------- #
# 語言碼正規化:接受 whisper code(zh/yue/ja…)或 iso3(zho/jpn…)
# --------------------------------------------------------------------------- #
def _lang_kind(lang: Optional[str]) -> str:
    """把任意語言碼歸類成 'yue' | 'zh' | 'other'。

    注意:config.to_iso3 把 zh 與 yue 都壓成 'zho',所以若只拿到 'zho' 無法分辨
    國語/粵語 → 預設走 pinyin(國語為多數情況)。呼叫端應盡量傳「原始 whisper code」
    (zh vs yue)才能正確選 jyutping。
    """
    if not lang:
        return "other"
    code = lang.strip().lower()
    if code in ("yue", "zh-yue", "yue-hant", "cantonese", "粤", "粵"):
        return "yue"
    if code in ("zh", "zho", "cmn", "zh-cn", "zh-tw", "zh-hant", "zh-hans", "mandarin", "chi"):
        # 'zho' 同時涵蓋國語/粵語,這裡保守當國語(pinyin);粵語請傳 'yue'。
        return "zh"
    return "other"


# --------------------------------------------------------------------------- #
# 粵語 jyutping:整行 → {字元index: 無聲調音節}
# --------------------------------------------------------------------------- #
def _split_jyutping(jp: str) -> list[str]:
    """把連在一起的 jyutping 字串(如 'hoeng1gong2jan4')切回逐音節。

    優先用 pycantonese.parse_jyutping(回傳 Jyutping 物件,有 onset/nucleus/coda/tone),
    保證音節數與字數對齊;失敗則退回以聲調數字為界的 regex 切法。
    """
    if not jp:
        return []
    # 1) 函式庫原生解析器(最穩)
    try:
        parsed = pycantonese.parse_jyutping(jp)  # type: ignore[union-attr]
        sylls: list[str] = []
        for p in parsed:
            onset = getattr(p, "onset", "") or ""
            nucleus = getattr(p, "nucleus", "") or ""
            coda = getattr(p, "coda", "") or ""
            sylls.append(f"{onset}{nucleus}{coda}")
        if sylls:
            return sylls
    except Exception:  # noqa: BLE001
        logger.debug("parse_jyutping 失敗,改用 regex 切音節", exc_info=True)
    # 2) 後備:以聲調數字為界切(jyutping 每個音節以 1 位數字結尾)
    return [_DIGITS.sub("", s) for s in re.findall(r"[a-zA-Z]+[0-9]?", jp)]


def _jyutping_line_map(line: str) -> dict:
    """整行 → {字元index: 無聲調 jyutping 音節}(best effort,缺的字直接不放)。"""
    out: dict = {}
    if not HAS_JYUTPING or not line:
        return out
    try:
        pos = 0
        for word, jp in pycantonese.characters_to_jyutping(line):  # type: ignore[union-attr]
            wlen = len(word)
            if jp:
                sylls = _split_jyutping(jp)
                if len(sylls) == wlen:
                    for i, syl in enumerate(sylls):
                        clean = _DIGITS.sub("", syl).strip().lower()
                        if clean:
                            out[pos + i] = clean
                # 音節數對不上字數時:整段略過(寧缺勿錯,該段退回 token 級/uroman)
            pos += wlen
    except Exception:  # noqa: BLE001
        logger.debug("characters_to_jyutping 失敗,粵語行退回後援", exc_info=True)
        return {}
    return out


# --------------------------------------------------------------------------- #
# 國語 pinyin:整行 → {字元index: 無聲調音節}
# --------------------------------------------------------------------------- #
def _pinyin_line_map(line: str) -> dict:
    """整行 → {字元index: 無聲調 pinyin 音節}。lazy_pinyin 1 字 1 entry,直接 zip。"""
    out: dict = {}
    if not HAS_PINYIN or not line:
        return out
    try:
        # errors='default' → 非漢字原樣通過;Style.NORMAL → 無聲調符號
        sylls = lazy_pinyin(line, style=Style.NORMAL, errors="default")  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001
        logger.debug("lazy_pinyin 失敗,國語行退回後援", exc_info=True)
        return {}
    # lazy_pinyin 對「1 個輸入字」通常回 1 個 entry,但非漢字段落可能保留整段。
    # 只有當 entry 數 == 字元數(1:1)時才安心建 map;否則退回逐字呼叫。
    if len(sylls) == len(line):
        for i, syl in enumerate(sylls):
            clean = _DIGITS.sub("", str(syl)).strip().lower()
            if clean:
                out[i] = clean
        return out
    # 1:1 對不上 → 逐字呼叫(失去詞context但保證對齊),仍比整段壞掉好。
    try:
        for i, ch in enumerate(line):
            one = lazy_pinyin(ch, style=Style.NORMAL, errors="default")  # type: ignore[union-attr]
            if one:
                clean = _DIGITS.sub("", str(one[0])).strip().lower()
                if clean:
                    out[i] = clean
    except Exception:  # noqa: BLE001
        logger.debug("lazy_pinyin 逐字後援失敗", exc_info=True)
    return out


# --------------------------------------------------------------------------- #
# uroman 後備(整字串)
# --------------------------------------------------------------------------- #
def _uroman_str(text: str) -> str:
    if not HAS_UROMAN or not text:
        return text
    try:
        return _UROMAN.romanize_string(text)  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001
        logger.debug("uroman romanize_string 失敗", exc_info=True)
        return text


# --------------------------------------------------------------------------- #
# 對外:整行羅馬化 map(align.py 主要用這個)
# --------------------------------------------------------------------------- #
def romanize_line_map(line: str, lang: Optional[str]) -> dict:
    """把整行依語言羅馬化成 {字元index: 拉丁音節}(無聲調、已 lower)。

    僅含「成功取得音節」的字元;缺的字(標點、英文、罕字、或後端不可用)不會出現在
    map 裡 —— 呼叫端對缺漏的字元應退回 romanize_token/uroman 或略過。

    yue → jyutping;zh → pinyin;other → 空 map(整行交給 token 級 uroman 後援)。
    """
    if not line:
        return {}
    kind = _lang_kind(lang)
    try:
        if kind == "yue":
            m = _jyutping_line_map(line)
            if m:
                return m
            # 粵語但 pycantonese 不可用/失敗 → 退回 pinyin(總比 uroman 貼近)
            return _pinyin_line_map(line)
        if kind == "zh":
            return _pinyin_line_map(line)
    except Exception:  # noqa: BLE001
        logger.debug("romanize_line_map 失敗,回空 map", exc_info=True)
    return {}


# --------------------------------------------------------------------------- #
# 對外:單一 token 羅馬化(per-line map 取不到時的後援)
# --------------------------------------------------------------------------- #
def romanize_token(text: str, lang: Optional[str]) -> str:
    """把單一 token 羅馬化成拉丁字串(尚未過濾 a–z;呼叫端負責 lower+去非字母)。

    - 純 Latin/非 CJK token:原樣回傳(英文走這條,apostrophe 由呼叫端保留)。
    - CJK token:依 lang 走 jyutping / pinyin;失敗逐層退回 uroman → identity。

    這是「逐 token」入口;為了精度,align.py 應先試 romanize_line_map(保留詞context),
    僅在 map 缺該字時才呼叫本函式。
    """
    if not text:
        return text
    kind = _lang_kind(lang)

    # 先試語言感知逐字(對單一 CJK 字而言,line map == token map)
    try:
        if kind == "yue":
            m = _jyutping_line_map(text)
            if m and len(m) == len([c for c in text]) - text.count(" "):
                # 多數情況 text 是單字;直接拼接 map 內音節
                joined = "".join(m.get(i, "") for i in range(len(text)))
                if joined:
                    return joined
        elif kind == "zh":
            m = _pinyin_line_map(text)
            if m:
                joined = "".join(m.get(i, "") for i in range(len(text)))
                if joined:
                    return joined
    except Exception:  # noqa: BLE001
        logger.debug("romanize_token 語言感知路徑失敗,退回 uroman", exc_info=True)

    # 後備:uroman(jpn/kor/其他,或上面失敗)→ 最後 identity
    return _uroman_str(text)
