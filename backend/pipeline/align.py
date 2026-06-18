"""
pipeline/align.py — 強制對齊(完整歌詞模式)

當使用者貼上「完整歌詞」時走這條路:把既有文字對齊到音訊,得到接近完美的逐字時間軸。

實作:**torchaudio 原生強制對齊**(`torchaudio.functional.forced_align` + `MMS_FA` bundle)。
這條路的關鍵好處 —— **完全免 C/C++ 編譯器**:forced_align 已隨 torchaudio wheel 預編譯,
MMS_FA 是多語 wav2vec2-CTC 對齊模型。因此 Windows 使用者不需安裝 Visual C++ Build Tools
(這正是先前 ctc-forced-aligner 從原始碼建置失敗的原因)。

設計重點
--------
1. **CJK 逐字粒度**:中文一整行沒有空白,若整行當「一個詞」時間軸就爛掉。所以對齊前先
   自建 token plan:每一非空行,Latin 連續段以空白切、CJK 連續段「逐字」切,並保留
   `token_line_idx[]` 平行陣列,事後把逐 token 結果重新分組回原行。
2. **保留使用者的斷行**:每一非空原始行 = 一個 segment(line)。
3. **羅馬化(CJK)**:MMS_FA 的字典是拉丁字母,CJK 需先羅馬化。若安裝了 `uroman`
   (純 Python、免編譯)則自動羅馬化中日韓 → 可逐字對齊;未安裝時 CJK token 取不到
   字典字元,該 token 不對齊(上層 pipeline 會退回 biasing)。英文/拉丁語則直接對齊。
4. **優雅降級**:torch / torchaudio 匯入失敗 → `is_available()` 回 False、`align()` 拋
   明確 RuntimeError(由上層 pipeline 決定 fallback)。整個伺服器絕不因此崩潰。
5. 全域快取對齊模型,避免每個 job 重載權重。

回傳形狀與 transcribe() 一致(API_CONTRACT 的 Result.segments):
    {
      "language": str,
      "segments": [
        { "start": float, "end": float, "text": str,
          "words": [ {"start": float, "end": float, "word": str, "prob": float} ] }
      ]
    }
"""

from __future__ import annotations

import logging
import re
import threading
import unicodedata
from typing import Any, Callable, Optional

logger = logging.getLogger("autolyrics.align")

# --------------------------------------------------------------------------- #
# 重型相依:torch + torchaudio(MMS_FA + forced_align)。匯入失敗時整支模組仍可
# 載入,只是 is_available() 會回 False,align() 會丟出可被上層捕捉的 RuntimeError。
# --------------------------------------------------------------------------- #
_IMPORT_ERROR: Optional[str] = None
try:
    import torch  # type: ignore
    import torchaudio  # type: ignore
    import torchaudio.functional as AF  # type: ignore
    from torchaudio.pipelines import MMS_FA as _BUNDLE  # type: ignore

    _HAS_ALIGNER = True
except Exception as exc:  # pragma: no cover - 取決於環境
    torch = None  # type: ignore
    torchaudio = None  # type: ignore
    AF = None  # type: ignore
    _BUNDLE = None  # type: ignore
    _HAS_ALIGNER = False
    _IMPORT_ERROR = f"{type(exc).__name__}: {exc}"
    logger.warning("torchaudio 對齊不可用(已降級):%s", _IMPORT_ERROR)

# 語言感知羅馬化器(粵語→jyutping / 國語→pinyin / 其他→uroman)。
# romanize 模組自帶 import-time 偵測 + 全程 try/except,缺套件僅降級不崩潰。
try:  # pragma: no cover - 取決於環境
    from . import romanize as _romanize  # type: ignore
except Exception:  # noqa: BLE001
    _romanize = None  # type: ignore
    logger.warning("romanize 模組載入失敗,CJK 將退回不羅馬化(僅英文可對齊)")


# 進度回呼型別:progress(stage: str, pct: float, msg: str)
ProgressFn = Callable[[str, float, str], None]


# --------------------------------------------------------------------------- #
# 模型快取(MMS_FA 與單一語言無關,依 (device, with_star) 快取即可)
# --------------------------------------------------------------------------- #
_MODEL_CACHE: dict[tuple[str, bool], tuple[Any, dict, int, Optional[int]]] = {}
_MODEL_LOCK = threading.Lock()

# 星號 token 的字典字元;插在「行與行之間」讓對齊器可吸收前奏/間奏/未貼上的 ad-lib。
_STAR_CHAR = "*"


def is_available() -> bool:
    """強制對齊功能是否可用。供 /api/meta 的 aligner 旗標使用。"""
    return _HAS_ALIGNER


def _resolve_device(device: str) -> str:
    """把 'auto' 解析為實際裝置;cuda 不可用時退回 cpu。"""
    if device == "auto":
        if torch is not None and torch.cuda.is_available():  # type: ignore[union-attr]
            return "cuda"
        return "cpu"
    if device == "cuda" and (torch is None or not torch.cuda.is_available()):  # type: ignore[union-attr]
        logger.warning("要求 cuda 但不可用,退回 cpu")
        return "cpu"
    return device


def _get_model(device: str, with_star: bool = False) -> tuple[Any, dict, int, Optional[int]]:
    """載入並快取 (model, dictionary, sample_rate, star_index)。MMS_FA = 多語 wav2vec2-CTC。

    with_star=True 時載入含星號 token 的模型/字典,並回傳星號的字典索引(供行間插入,
    讓前奏/間奏/未貼上的 ad-lib 被 `*` 吸收而非污染真正歌詞的時間)。star_index 在
    with_star=False 時為 None。
    """
    key = (device, with_star)
    cached = _MODEL_CACHE.get(key)
    if cached is not None:
        return cached
    with _MODEL_LOCK:
        cached = _MODEL_CACHE.get(key)
        if cached is not None:
            return cached
        logger.info("載入 MMS_FA 對齊模型 device=%s with_star=%s(首次會下載權重)", device, with_star)
        model = _BUNDLE.get_model(with_star=with_star).to(device).eval()  # type: ignore[union-attr]
        star_arg = _STAR_CHAR if with_star else None
        dictionary = _BUNDLE.get_dict(star=star_arg)  # type: ignore[union-attr]  # char -> index
        sample_rate = int(_BUNDLE.sample_rate)  # type: ignore[union-attr]  # 16000
        star_index = dictionary.get(_STAR_CHAR) if with_star else None
        _MODEL_CACHE[key] = (model, dictionary, sample_rate, star_index)
        return _MODEL_CACHE[key]


# --------------------------------------------------------------------------- #
# Token plan:把使用者貼的多行歌詞拆成「對齊用 token」並保留原行對應
# --------------------------------------------------------------------------- #
def _is_cjk(ch: str) -> bool:
    """是否為 CJK(含中日韓統一表意、擴展、假名、諺文、全形標點等)。"""
    if ch.isspace():
        return False
    code = ord(ch)
    if (
        0x3040 <= code <= 0x30FF      # 平假名 + 片假名
        or 0x3400 <= code <= 0x4DBF   # CJK 擴展 A
        or 0x4E00 <= code <= 0x9FFF   # CJK 統一表意
        or 0xF900 <= code <= 0xFAFF   # CJK 兼容表意
        or 0xAC00 <= code <= 0xD7A3   # 諺文音節
        or 0x3130 <= code <= 0x318F   # 諺文相容字母
        or 0xFF00 <= code <= 0xFFEF   # 全形/半形
        or 0x20000 <= code <= 0x2FA1F # CJK 擴展 B~F + 兼容補充
    ):
        return True
    try:
        name = unicodedata.name(ch)
    except ValueError:
        return False
    return name.startswith(("CJK", "HIRAGANA", "KATAKANA", "HANGUL"))


def _tokenize_line(line: str) -> list[str]:
    """
    把單一行拆成對齊 token:
      - CJK 字元:逐字成 token
      - Latin / 數字 / 其他連續非空白段:整段為一個 token(以空白為界)
    範例:"明天 see you" -> ["明", "天", "see", "you"]
          "Hello 世界!"  -> ["Hello", "世", "界", "！"]
    """
    tokens: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        if buf:
            tokens.append("".join(buf))
            buf.clear()

    for ch in line:
        if ch.isspace():
            flush()
        elif _is_cjk(ch):
            flush()
            tokens.append(ch)
        else:
            buf.append(ch)
    flush()
    return tokens


def _tokenize_line_with_offsets(line: str) -> list[tuple[str, int]]:
    """同 _tokenize_line,但每個 token 附帶它在原行中的起始字元 index(供 per-line 羅馬化對映)。"""
    tokens: list[tuple[str, int]] = []
    buf: list[str] = []
    buf_start = 0

    def flush() -> None:
        nonlocal buf_start
        if buf:
            tokens.append(("".join(buf), buf_start))
            buf.clear()

    for i, ch in enumerate(line):
        if ch.isspace():
            flush()
        elif _is_cjk(ch):
            flush()
            tokens.append((ch, i))
        else:
            if not buf:
                buf_start = i
            buf.append(ch)
    flush()
    return tokens


def _build_token_plan(
    transcript_text: str,
    lang: Optional[str] = None,
) -> tuple[list[str], list[int], list[str], list[Optional[str]]]:
    """
    從原始多行歌詞建立 token plan。

    回傳:
      tokens        — 扁平 token 列表
      token_line_idx— 與 tokens 等長,記錄每個 token 屬於第幾個「輸出行」
      line_texts    — 每個輸出行的原始文字(保留原斷行,trim 兩端空白)
      token_roman   — 與 tokens 等長,CJK token 的預羅馬化拉丁音節(整行 map 取得,保留詞
                      context);非 CJK 或無 map 時為 None(交給 _normalize_token 後援)。
    """
    tokens: list[str] = []
    token_line_idx: list[int] = []
    line_texts: list[str] = []
    token_roman: list[Optional[str]] = []

    for raw_line in transcript_text.splitlines():
        toks_off = _tokenize_line_with_offsets(raw_line)
        if not toks_off:
            continue

        # 整行一次羅馬化(保留詞context消歧),建 {字元index: 音節} map。
        line_map: dict = {}
        if _romanize is not None and any(_is_cjk(c) for c in raw_line):
            try:
                line_map = _romanize.romanize_line_map(raw_line, lang)
            except Exception:  # noqa: BLE001
                line_map = {}

        out_idx = len(line_texts)
        line_texts.append(raw_line.strip())
        for tok, off in toks_off:
            tokens.append(tok)
            token_line_idx.append(out_idx)
            # 單一 CJK 字 token → 直接查 map;多字 latin token → None。
            if len(tok) == 1 and _is_cjk(tok) and off in line_map:
                token_roman.append(line_map[off])
            else:
                token_roman.append(None)

    return tokens, token_line_idx, line_texts, token_roman


# --------------------------------------------------------------------------- #
# Token 正規化:把一個顯示 token 變成 MMS_FA 字典可接受的「字元索引序列」
# --------------------------------------------------------------------------- #
def _normalize_token(
    tok: str,
    dictionary: dict,
    lang: Optional[str] = None,
    pre_roman: Optional[str] = None,
) -> list[int]:
    """
    把單一 token 正規化成字典索引序列:
      1. CJK 先羅馬化:優先用 `pre_roman`(由整行 romanize_line_map 取得,保留詞context消歧),
         否則呼叫 romanize.romanize_token(依語言走 jyutping/pinyin/uroman)。
      2. 轉小寫、把非 a-z' 字元去除(同時剝掉 jyutping/pinyin 的聲調數字)。
      3. 逐字元查字典;不在字典中的字元(數字、標點…)直接略過。
    取不到任何索引時回傳空 list(該 token 不參與對齊,regroup 會補時間)。
    """
    has_cjk = any(_is_cjk(c) for c in tok)
    if has_cjk:
        if pre_roman:
            text = pre_roman
        elif _romanize is not None:
            try:
                text = _romanize.romanize_token(tok, lang)
            except Exception:  # noqa: BLE001
                text = tok
        else:
            text = tok
    else:
        # 英文/拉丁:原樣(apostrophe 是字典 token,don't / we'll 原生對齊)
        text = tok
    text = text.lower()
    text = re.sub(r"[^a-z']", "", text)  # MMS_FA 拉丁字典:a-z 與省略號
    return [dictionary[c] for c in text if c in dictionary]


def _empty_result(language: str) -> dict:
    return {"language": language, "segments": []}


def _load_waveform(path: str, target_sr: int) -> Any:
    """讀音訊成 (1, N) 單聲道 float32 Tensor,取樣率=target_sr。

    **刻意避開 torchaudio.load** —— torchaudio 2.11 的 load 改走 torchcodec(預設未安裝),
    會丟 ImportError。改用後備鏈:soundfile(人聲 wav 走這條)→ PyAV(faster-whisper 的
    decode_audio,內含 ffmpeg,處理 mp3 等)→ 最後才退回 torchaudio.load。
    """
    # 1) soundfile(libsndfile;wav/flac/ogg)
    try:
        import soundfile as sf  # type: ignore

        data, sr = sf.read(path, always_2d=True, dtype="float32")  # (n, ch)
        wav = torch.from_numpy(data.T)  # type: ignore[union-attr]  # (ch, n)
        if wav.shape[0] > 1:
            wav = wav.mean(0, keepdim=True)
        if sr != target_sr:
            wav = torchaudio.functional.resample(wav, sr, target_sr)  # type: ignore[union-attr]
        return wav.float()
    except Exception as exc:
        logger.debug("soundfile 讀取失敗,改用 PyAV(%s)", exc)

    # 2) PyAV(直接回 target_sr 單聲道)
    try:
        from faster_whisper.audio import decode_audio  # type: ignore

        mono = decode_audio(path, sampling_rate=target_sr)
        return torch.from_numpy(mono).float().unsqueeze(0)  # type: ignore[union-attr]
    except Exception as exc:
        logger.debug("PyAV 解碼失敗,最後嘗試 torchaudio.load(%s)", exc)

    # 3) 最後手段:torchaudio.load(可能需要 torchcodec)
    wav, sr = torchaudio.load(path)  # type: ignore[union-attr]
    if wav.shape[0] > 1:
        wav = wav.mean(0, keepdim=True)
    if sr != target_sr:
        wav = torchaudio.functional.resample(wav, sr, target_sr)  # type: ignore[union-attr]
    return wav.float()


# --------------------------------------------------------------------------- #
# Onset 精修:把 token / 行的「起點」吸附到人聲的真實能量起音點
# --------------------------------------------------------------------------- #
# forced_align 給的是 frame 量化邊界(MMS_FA frame ≈ 20ms)。對卡拉OK / 饒舌而言,
# 把每個 token 的 start 吸附到最近的真實人聲起音點能明顯收緊時間。純 numpy、只跑一次
# O(N),相對模型前向可忽略。整段包 try/except —— 失敗就回傳「未吸附」的時間(降級契約)。

def _compute_onsets(wav_np: Any, sr: int, hop: int = 160, win: int = 400) -> Any:
    """從(單聲道 16k)人聲波形算出起音時間點陣列(秒)。能量 flux 半波整流 + 自適應峰選。

    回傳 numpy 1D array(可能為空)。任何失敗回空陣列。
    """
    try:
        import numpy as np  # type: ignore
    except Exception:  # noqa: BLE001
        return None
    try:
        wav_np = np.asarray(wav_np, dtype=np.float32).reshape(-1)
        if wav_np.size < win + hop:
            return np.array([], dtype=np.float32)
        # 切窗(stride view),逐窗 RMS 能量
        frames = np.lib.stride_tricks.sliding_window_view(wav_np, win)[::hop]
        if frames.shape[0] < 3:
            return np.array([], dtype=np.float32)
        rms = np.sqrt(np.mean(frames.astype(np.float32) ** 2, axis=1) + 1e-12)
        le = np.log(rms + 1e-6)
        # 3-frame 移動平均去噪
        le = np.convolve(le, np.ones(3, dtype=np.float32) / 3.0, mode="same")
        # 能量 flux(正向一階差、半波整流)
        flux = np.maximum(0.0, np.diff(le, prepend=le[:1]))
        thr = float(np.median(flux) + 0.5 * np.std(flux))
        # ±1 frame 局部極大 + 自適應門檻
        onsets = []
        for k in range(1, len(flux) - 1):
            fk = flux[k]
            if fk >= flux[k - 1] and fk > flux[k + 1] and fk > thr:
                onsets.append(k * hop / float(sr))
        return np.array(onsets, dtype=np.float32)
    except Exception:  # noqa: BLE001
        logger.debug("onset 偵測失敗,跳過吸附", exc_info=True)
        try:
            import numpy as np  # type: ignore

            return np.array([], dtype=np.float32)
        except Exception:  # noqa: BLE001
            return None


def _snap_starts(word_ts: list[dict], onsets: Any, delta: float = 0.08) -> None:
    """就地把每個 token 的 start 吸附到 ±delta 內最近的起音點,且:
      - 不可早於上一個 token 的(已吸附)start(維持單調)
      - 不可越過自己的 end
    end 一律保持原樣(對饒舌只吸附 start 最安全)。失敗則完全不動。
    """
    try:
        import numpy as np  # type: ignore
    except Exception:  # noqa: BLE001
        return
    if onsets is None or getattr(onsets, "size", 0) == 0 or not word_ts:
        return
    try:
        prev_start = 0.0
        for w in word_ts:
            t_s = float(w.get("start", 0.0))
            t_e = float(w.get("end", t_s))
            i = int(np.argmin(np.abs(onsets - t_s)))
            o = float(onsets[i])
            # 在窗內、不越過自己的 end、不早於前一個 start → 吸附
            if abs(o - t_s) <= delta and prev_start <= o <= t_e:
                w["start"] = o
                if w.get("end", o) < o:
                    w["end"] = o
            prev_start = float(w.get("start", t_s))
    except Exception:  # noqa: BLE001
        logger.debug("start 吸附失敗,保留原時間", exc_info=True)


# --------------------------------------------------------------------------- #
# merge_tokens 反展開:把「被併的相鄰相同 token」還原成「每個目標一個 span」
# --------------------------------------------------------------------------- #
class _Span:
    """輕量 TokenSpan 替身,攜帶下游用到的 start/end/score/token。"""

    __slots__ = ("token", "start", "end", "score")

    def __init__(self, token: int, start: float, end: float, score: float) -> None:
        self.token = token
        self.start = start
        self.end = end
        self.score = score


def _expand_spans_to_targets(all_spans: list, flat_targets: list[int]) -> list:
    """把 merge_tokens 的 spans 對映回「每個 flat_target 一個 span」。

    `torchaudio.functional.merge_tokens` 走 frame-level `aligned` 序列,**每段連續相同
    token id** 只發出一個 `TokenSpan`(帶 .token/.start/.end/.score)。因此只要 flat_targets
    裡有相鄰相同的字典索引(英文雙字母、CJK 音節邊界重複字母…),spans 數就會 < targets 數,
    破壞「一 span 一 target」不變式。

    本函式以 span.token 對齊 flat_targets 的順序:逐一吃掉一個 span,看它對應 flat_targets
    裡接下來「連續幾個相同 id」(K 個),把這個 span 的 frame 範圍**按等分**切成 K 個子 span
    分配回去。任一處 token 對不上(理論上不該發生)→ 回傳原 spans(由呼叫端走 star 過濾降級)。
    """
    out: list = []
    ti = 0  # flat_targets 游標
    n_targets = len(flat_targets)
    for sp in all_spans:
        tok = getattr(sp, "token", None)
        if ti >= n_targets or tok != flat_targets[ti]:
            # 對不上:放棄展開,讓呼叫端走降級分支。
            logger.debug(
                "span.token=%r 與 flat_targets[%d]=%r 不符,放棄展開",
                tok, ti, flat_targets[ti] if ti < n_targets else None,
            )
            return list(all_spans)
        # 這個 span 對應 flat_targets[ti:] 中連續相同 id 的數量 K
        k = 1
        while ti + k < n_targets and flat_targets[ti + k] == tok:
            k += 1
        sp_start = float(getattr(sp, "start", 0.0))
        sp_end = float(getattr(sp, "end", sp_start))
        sp_score = float(getattr(sp, "score", 0.0))
        if k == 1:
            out.append(_Span(tok, sp_start, sp_end, sp_score))
        else:
            # 等分這個被併的 run(無逐幀資訊可用,等分是最中性的拆法)。
            span_len = sp_end - sp_start
            for j in range(k):
                s = sp_start + span_len * (j / k)
                e = sp_start + span_len * ((j + 1) / k)
                out.append(_Span(tok, s, e, sp_score))
        ti += k
    if ti != n_targets:
        # spans 用完但 targets 還有剩 → 對不齊,降級。
        logger.debug("展開後游標 %d ≠ 目標數 %d,放棄展開", ti, n_targets)
        return list(all_spans)
    return out


# --------------------------------------------------------------------------- #
# 主入口
# --------------------------------------------------------------------------- #
def align(
    audio_path: str,
    transcript_text: str,
    language: str = "zho",
    device: str = "cuda",
    progress: Optional[ProgressFn] = None,
    refine: bool = True,
    lang_code: Optional[str] = None,
) -> dict:
    """
    對既有歌詞做強制對齊,回傳逐行(內含逐 token / 逐字)時間軸。

    參數
    ----
    audio_path : 音訊路徑(理想為已分離的人聲 wav,任何可解碼音訊皆可)。
    transcript_text : 使用者貼上的完整歌詞;**斷行有意義**,會被保留為各 segment。
    language : ISO-639-3 語言碼(zho / eng / jpn / kor …),回傳結果的標記。
    device : "cuda" | "cpu" | "auto"。
    progress : progress(stage, pct, msg) 進度回呼(可選)。
    refine : 是否做 onset 吸附精修(把每個 token / 行的 start 吸附到真實人聲起音點)。
    lang_code : **原始 whisper 語言碼**(zh / yue / ja …),用來選羅馬化器(jyutping vs
                pinyin)。因 iso3 把 zh/yue 都壓成 zho,務必傳這個才能正確選粵語 jyutping;
                未傳則退回用 `language`(iso3)猜,zho 預設走國語 pinyin。

    失敗策略:相依缺失或無可對齊文字 → RuntimeError(由上層改走 transcribe)。
    """
    # 羅馬化選擇用「原始 whisper 碼」優先(zh vs yue),否則退回 iso3(語意較粗)。
    roman_lang = lang_code or language

    def _emit(stage: str, pct: float, msg: str) -> None:
        if progress is not None:
            try:
                progress(stage, pct, msg)
            except Exception:
                logger.debug("progress 回呼丟出例外(已忽略)", exc_info=True)

    if not _HAS_ALIGNER:
        raise RuntimeError(
            "強制對齊不可用:torch / torchaudio 未安裝或匯入失敗"
            + (f"({_IMPORT_ERROR})" if _IMPORT_ERROR else "")
        )

    # --- 1) 建立 token plan(保留斷行 + CJK 逐字 + 整行羅馬化 map) ---------- #
    _emit("align", 41.0, "準備歌詞對齊…")
    tokens, token_line_idx, line_texts, token_roman = _build_token_plan(transcript_text, roman_lang)
    if not tokens:
        logger.warning("歌詞為空或無可對齊內容,回傳空結果")
        return _empty_result(language)

    dev = _resolve_device(device)

    try:
        # --- 2) 載入模型 + 音訊(重採樣到 16k 單聲道) -------------------- #
        # with_star=True:行間插入 `*` 讓前奏/間奏/未貼上的 ad-lib 被吸收,不污染真詞時間。
        _emit("align", 45.0, "載入對齊模型…")
        model, dictionary, sr, star_index = _get_model(dev, with_star=True)
        use_star = star_index is not None

        _emit("align", 55.0, "讀取音訊…")
        waveform = _load_waveform(audio_path, sr).to(dev)

        # --- 3) 把每個 token 正規化成字典索引序列(語言感知羅馬化) -------- #
        per_token_ids: list[list[int]] = [
            _normalize_token(t, dictionary, lang=roman_lang, pre_roman=pr)
            for t, pr in zip(tokens, token_roman)
        ]
        if not any(per_token_ids):
            raise RuntimeError(
                "歌詞無可對齊字元(CJK 需安裝 pypinyin/pycantonese/uroman 才能羅馬化對齊;"
                "或文字全為數字/標點)。"
            )

        # 組 flat_targets,並在「每一行的結尾與下一行之間」插入一個 star token。
        # 同時記錄每個目標索引是否為 star(事後過濾 char_spans 用)。
        # ★ 關鍵:merge_tokens 會把「連續相同 token」併成一個 span,所以**絕不**讓兩個
        #   star 相鄰(否則 span 數對不上 flat_targets,過濾退化)。用 _emit_star 保證:
        #   只有在「上一個寫入的不是 star」時才寫 star。
        flat_targets: list[int] = []
        is_star_flag: list[bool] = []

        def _emit_star() -> None:
            if is_star_flag and is_star_flag[-1]:
                return  # 上一個已是 star → 不重複(避免 merge_tokens 併 span)
            flat_targets.append(int(star_index))
            is_star_flag.append(True)

        if use_star:
            _emit_star()  # 開頭 star 吸收前奏(否則第一個字的 start 被拉向 t=0)
        prev_line = token_line_idx[0] if token_line_idx else 0
        for ids, line_idx in zip(per_token_ids, token_line_idx):
            if use_star and line_idx != prev_line:
                _emit_star()
                prev_line = line_idx
            for idx in ids:
                flat_targets.append(idx)
                is_star_flag.append(False)
        if use_star:
            _emit_star()  # 結尾 star 吸收尾奏

        if not any(not s for s in is_star_flag):
            raise RuntimeError("歌詞無可對齊字元(全為標點/數字或羅馬化失敗)。")

        # --- 4) 推論 emissions + 強制對齊 -------------------------------- #
        _emit("align", 65.0, "計算聲學機率…")
        with torch.inference_mode():  # type: ignore[union-attr]
            emission, _lengths = model(waveform)
        num_frames = emission.size(1)
        ratio = waveform.size(1) / num_frames  # 每個 emission frame 對應的取樣點數

        _emit("align", 80.0, "對齊文字與音訊…")
        targets = torch.tensor([flat_targets], dtype=torch.int32, device=emission.device)  # type: ignore[union-attr]
        # 含 star 時 blank 仍為 0;star 是字典裡的另一個 token,forced_align 照常處理。
        aligned, scores = AF.forced_align(emission, targets, blank=0)  # type: ignore[union-attr]
        aligned, scores = aligned[0], scores[0].exp()  # log → prob
        all_spans = AF.merge_tokens(aligned, scores)  # type: ignore[union-attr]
        # ★ merge_tokens 會把「frame-level 連續相同 token id」併成一個 span,所以只要有
        #   兩個相鄰 target 的字典索引相同(英文雙字母 hello/coffee… 或 CJK 音節邊界
        #   重複的字母),all_spans 會比 flat_targets 少 → 不能假設一對一。先把 spans
        #   依 flat_targets 重新展開回「每個目標一個 span」(被併的 run 按比例切),
        #   再依 is_star_flag 過濾掉 star。
        per_target_spans = _expand_spans_to_targets(all_spans, flat_targets)
        if len(per_target_spans) == len(flat_targets):
            n_star = sum(1 for st in is_star_flag if st)
            char_spans = [sp for sp, st in zip(per_target_spans, is_star_flag) if not st]
            logger.debug("展開後 span 數=%d,丟棄 star span %d 個", len(per_target_spans), n_star)
        else:
            # 仍對不上(極端情況)→ 至少不能保留 star span(否則整首位移 num_star 個)。
            # 以 span.token == star_index 過濾掉 star,降級但不污染真詞時間。
            n_star = sum(1 for sp in all_spans if getattr(sp, "token", None) == star_index)
            char_spans = [sp for sp in all_spans if getattr(sp, "token", None) != star_index]
            logger.warning(
                "span 重新展開仍不符(展開後 %d ≠ 目標 %d);改以 token==star 過濾,丟棄 %d 個 star span",
                len(per_target_spans), len(flat_targets), n_star,
            )

        flat_char_count = sum(len(ids) for ids in per_token_ids)
        if len(char_spans) != flat_char_count:
            logger.warning(
                "對齊字元 span 數(%d)≠ 目標字元數(%d),仍盡量分組",
                len(char_spans), flat_char_count,
            )
    except RuntimeError:
        raise
    except Exception as exc:
        logger.exception("強制對齊失敗")
        raise RuntimeError(f"強制對齊失敗:{type(exc).__name__}: {exc}") from exc

    # --- 5) 把字元 span 依「每個 token 的字元數」拆回 token,再依行分組 ----- #
    _emit("align", 92.0, "整理逐字時間軸…")

    def _to_sec(frame: float) -> float:
        return max(0.0, float(frame) * ratio / sr)

    # 先把扁平的 char_spans 依 per_token_ids 長度切回每個 token
    word_ts: list[dict] = []
    cur = 0
    last_end = 0.0
    for tok, ids in zip(tokens, per_token_ids):
        n = len(ids)
        if n == 0 or cur >= len(char_spans):
            # 此 token 無可對齊字元 → 0 長度佔位(接在上一個結束點)
            word_ts.append({"text": tok, "start": last_end, "end": last_end, "score": 0.0})
            continue
        group = char_spans[cur:cur + n]
        cur += n
        if not group:
            word_ts.append({"text": tok, "start": last_end, "end": last_end, "score": 0.0})
            continue
        start = _to_sec(group[0].start)
        end = _to_sec(group[-1].end)
        if end < start:
            end = start
        score = sum(float(getattr(s, "score", 0.0)) for s in group) / len(group)
        last_end = end
        word_ts.append({"text": tok, "start": start, "end": end, "score": score})

    # --- 6) Onset 精修:把 token start 吸附到人聲真實起音點(可選、優雅降級)----- #
    if refine:
        try:
            _emit("align", 90.0, "精修起音時間…")
            wav_np = waveform.squeeze(0).detach().to("cpu").numpy()
            onsets = _compute_onsets(wav_np, sr)
            _snap_starts(word_ts, onsets)
        except Exception:  # noqa: BLE001
            logger.debug("onset 精修整體失敗,保留原時間(降級)", exc_info=True)

    segments = _regroup(word_ts, tokens, token_line_idx, line_texts)
    _emit("align", 95.0, f"對齊完成({len(segments)} 行)")
    return {"language": language, "segments": segments}


# --------------------------------------------------------------------------- #
# 重新分組:flat word_ts → 依原始行的 segments
# --------------------------------------------------------------------------- #
def _regroup(
    word_ts: list[dict],
    tokens: list[str],
    token_line_idx: list[int],
    line_texts: list[str],
) -> list[dict]:
    """把逐 token 結果按 token_line_idx 重新分組回原始行。"""
    n = min(len(word_ts), len(token_line_idx))
    if len(word_ts) != len(token_line_idx):
        logger.warning(
            "對齊 token 數(%d)與計畫 token 數(%d)不符,以 %d 對齊",
            len(word_ts), len(token_line_idx), n,
        )

    per_line: list[list[dict]] = [[] for _ in line_texts]

    def _f(x: Any, default: float = 0.0) -> float:
        try:
            v = float(x)
            return v if v == v else default
        except (TypeError, ValueError):
            return default

    for i in range(n):
        w = word_ts[i]
        line_idx = token_line_idx[i]
        start = _f(w.get("start"))
        end = _f(w.get("end"))
        if end < start:
            end = start
        text = (w.get("text") or "").strip() or tokens[i]
        prob = _clamp01(_f(w.get("score"), 0.0))
        per_line[line_idx].append(
            {"start": start, "end": end, "word": text, "prob": prob}
        )

    segments: list[dict] = []
    for idx, words in enumerate(per_line):
        if not words:
            segments.append(
                {"start": 0.0, "end": 0.0, "text": line_texts[idx], "words": []}
            )
            continue
        line_start = min(w["start"] for w in words)
        line_end = max(w["end"] for w in words)
        if line_end < line_start:
            line_end = line_start
        segments.append(
            {"start": line_start, "end": line_end, "text": line_texts[idx], "words": words}
        )

    return segments


def _clamp01(x: float) -> float:
    if x < 0.0:
        return 0.0
    if x > 1.0:
        return 1.0
    return x
