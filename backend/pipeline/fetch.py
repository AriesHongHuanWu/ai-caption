"""URL 媒體下載器(yt-dlp)—— 把 YouTube 及上千個平台的最佳音訊/影片抓下來,讓使用者接著在
下載器分析、或匯入字幕/歌詞流程、或拖進 DAW。

**使用責任**:這只是個下載工具(yt-dlp 是廣泛使用的開源軟體)。使用者必須對下載的內容
擁有權利(自己的作品、Creative Commons、免版稅、或已取得授權的 beats)。前端會明確要求
確認。本模組不繞過任何付費/DRM,只抓公開可取得的串流。

不需系統 ffmpeg:
  - 音訊:抓 bestaudio 的單一串流(不做 yt-dlp 後處理)→ PyAV(內含 ffmpeg 函式庫)解碼
    → soundfile 寫出 WAV/FLAC/MP3/OGG。
  - 影片:抓「已合流」的單一漸進式串流(progressive,影音同檔)→ 直接原樣存檔(免合併)。
    需要合併才能達到的高解析(video-only 串流)會標記為「不支援」,因為合併需要系統 ffmpeg。
"""

from __future__ import annotations

import glob
import logging
import os
import shutil
import tempfile
from typing import Any, Callable, Optional

logger = logging.getLogger("autolyrics.fetch")

try:
    import yt_dlp  # type: ignore
    _HAS = True
except Exception:  # pragma: no cover
    yt_dlp = None  # type: ignore
    _HAS = False

_AUDIO_OUTPUTS = ["wav", "flac", "mp3", "ogg"]
_VIDEO_PASSTHROUGH = {"mp4", "webm", "mkv", "mov"}


def is_available() -> bool:
    return _HAS


def _looks_like_url(s: str) -> bool:
    s = (s or "").strip().lower()
    return s.startswith("http://") or s.startswith("https://")


def _base_opts(tmpdir: str) -> dict:
    return {
        "outtmpl": os.path.join(tmpdir, "dl.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
        "nocheckcertificate": False,
        "socket_timeout": 30,        # 不讓卡住的連線無限等待
        "retries": 3,
    }


# --------------------------------------------------------------------------- #
# 探測可用格式
# --------------------------------------------------------------------------- #
def probe(url: str) -> dict:
    """探測 URL 的標題/時長與可用格式。回 {meta, audioAvailable, audioOutputs, videoOptions}。
    videoOptions 每筆含 supported(可否直接下載);需合併的高解析標 supported=False。"""
    if not _HAS:
        raise RuntimeError("yt-dlp 未安裝 —— 下載器不可用")
    if not _looks_like_url(url):
        raise ValueError("請貼上有效的網址(http/https)")

    opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:  # type: ignore[union-attr]
        info = ydl.extract_info(url, download=False)
    if isinstance(info, dict) and info.get("entries"):
        info = info["entries"][0]
    if not isinstance(info, dict):
        raise RuntimeError("無法解析此網址的媒體資訊")

    formats = info.get("formats") or []
    has_audio = False
    prog: dict[int, dict] = {}      # 漸進式(影音同檔,可直接下載)by height
    vonly: dict[int, dict] = {}     # video-only(需合併,不支援)by height
    for fm in formats:
        vcodec = (fm.get("vcodec") or "none")
        acodec = (fm.get("acodec") or "none")
        has_v = vcodec != "none"
        has_a = acodec != "none"
        ext = (fm.get("ext") or "").lower()
        height = int(fm.get("height") or 0)
        size = fm.get("filesize") or fm.get("filesize_approx")
        if has_a and not has_v:
            has_audio = True
        elif has_v and has_a and ext in _VIDEO_PASSTHROUGH:   # 漸進式
            cur = prog.get(height)
            if cur is None or (size or 0) > (cur.get("filesizeBytes") or 0):
                prog[height] = {"height": height, "ext": ext, "formatId": str(fm.get("format_id")),
                                "fps": int(fm.get("fps") or 0), "filesizeBytes": int(size or 0),
                                "supported": True, "kind": "video"}
        elif has_v and not has_a:                              # video-only(需合併)
            if height not in vonly:
                vonly[height] = {"height": height, "ext": ext, "formatId": str(fm.get("format_id")),
                                 "fps": int(fm.get("fps") or 0), "filesizeBytes": int(size or 0),
                                 "supported": False, "kind": "video", "reason": "needs-merge"}

    video_options = []
    for h in sorted(set(list(prog.keys()) + list(vonly.keys())), reverse=True):
        if h in prog:
            video_options.append(prog[h])
        elif h in vonly and h >= 240:   # 只列像樣的解析度
            video_options.append(vonly[h])

    return {
        "meta": {
            "title": str(info.get("title") or "media"),
            "uploader": str(info.get("uploader") or info.get("channel") or ""),
            "duration": float(info.get("duration") or 0),
            "thumbnail": str(info.get("thumbnail") or ""),
            "extractor": str(info.get("extractor_key") or info.get("extractor") or ""),
            "webpageUrl": str(info.get("webpage_url") or url),
        },
        "audioAvailable": True,                 # 我們一律走 bestaudio,可解碼即可
        "audioOutputs": _AUDIO_OUTPUTS,
        "videoOptions": video_options,
    }


# --------------------------------------------------------------------------- #
# 下載
# --------------------------------------------------------------------------- #
def fetch_media(url: str, out_path: str, *, kind: str = "audio", output_format: str = "wav",
                source_format_id: Optional[str] = None,
                progress: Optional[Callable[[str, float, str], None]] = None) -> dict:
    """下載媒體 → 寫到 out_path。
    kind='audio':抓 bestaudio → 解碼 → 編成 output_format(wav/flac/mp3/ogg)。
    kind='video':抓漸進式(或指定 source_format_id)→ 原樣存檔(免合併)。
    回 {title,duration,uploader,kind,ext,sr?}。失敗丟例外給呼叫端。"""
    if not _HAS:
        raise RuntimeError("yt-dlp 未安裝 —— 下載器不可用")
    if not _looks_like_url(url):
        raise ValueError("請貼上有效的網址(http/https)")
    kind = (kind or "audio").lower()

    tmpdir = tempfile.mkdtemp(prefix="fetchdl_")
    opts = _base_opts(tmpdir)
    if kind == "video":
        if source_format_id:
            opts["format"] = source_format_id
        else:
            # 最佳「漸進式」單檔(影音同檔,免 ffmpeg 合併)
            opts["format"] = "best[acodec!=none][vcodec!=none]/best"

        def _hook(d):
            if progress and d.get("status") == "downloading":
                tot = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                got = d.get("downloaded_bytes") or 0
                progress("download", (got / tot) if tot else 0.0, "下載中")
        opts["progress_hooks"] = [_hook]
    else:
        opts["format"] = "bestaudio/best"

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:  # type: ignore[union-attr]
            info = ydl.extract_info(url, download=True)
        if isinstance(info, dict) and info.get("entries"):
            info = info["entries"][0]
        files = sorted(glob.glob(os.path.join(tmpdir, "dl.*")), key=os.path.getsize, reverse=True)
        if not files:
            raise RuntimeError("下載沒有產生檔案")
        downloaded = files[0]
        title = str(info.get("title", "media")) if isinstance(info, dict) else "media"
        duration = float(info.get("duration", 0) or 0) if isinstance(info, dict) else 0.0
        uploader = str(info.get("uploader", "")) if isinstance(info, dict) else ""

        if kind == "video":
            ext = os.path.splitext(downloaded)[1].lstrip(".").lower() or "mp4"
            shutil.copyfile(downloaded, out_path)         # 原樣存檔(免轉碼)
            return {"title": title, "duration": duration, "uploader": uploader,
                    "kind": "video", "ext": ext}

        # audio:解碼(PyAV 內含 ffmpeg)→ 寫出目標格式
        from . import mastering as M
        from . import tools as T
        data, sr = M._load_audio(downloaded)
        fmt = (output_format or "wav").lower()
        if fmt not in T._ENCODE_EXT:
            fmt = "wav"
        T._encode(data, sr, out_path, fmt)
        return {"title": title, "duration": duration, "uploader": uploader,
                "kind": "audio", "ext": T._ENCODE_EXT[fmt], "sr": int(sr)}
    finally:
        try:
            for f in glob.glob(os.path.join(tmpdir, "*")):
                os.unlink(f)
            os.rmdir(tmpdir)
        except OSError:
            pass


def fetch_audio(url: str, out_path: str, fmt: str = "wav",
                progress: Optional[Callable[[str, float, str], None]] = None) -> dict:
    """相容舊版:抓最佳音訊。"""
    return fetch_media(url, out_path, kind="audio", output_format=fmt, progress=progress)


def media_ext(kind: str, output_format: str, source_ext: str = "mp4") -> str:
    """這次下載產生的副檔名(供 API 命名輸出檔)。"""
    if (kind or "audio").lower() == "video":
        e = (source_ext or "mp4").lower()
        return e if e in _VIDEO_PASSTHROUGH else "mp4"
    from . import tools as T
    return T._ENCODE_EXT.get((output_format or "wav").lower(), "wav")


def fetch_ext(fmt: str) -> str:
    from . import tools as T
    return T._ENCODE_EXT.get((fmt or "wav").lower(), "wav")
