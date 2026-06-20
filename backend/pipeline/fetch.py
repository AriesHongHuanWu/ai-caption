"""URL 音訊下載器(yt-dlp)—— 把 YouTube / 各站的最佳音訊抓下來,轉成 WAV/FLAC/MP3,
讓使用者接著在工具箱/母帶裡處理。

**使用責任**:這只是個下載工具(yt-dlp 是廣泛使用的開源軟體)。使用者必須對下載的內容
擁有權利(自己的作品、Creative Commons、免版稅、或已取得授權的 beats)。前端會明確要求
確認。本模組不繞過任何付費/DRM,只抓公開可取得的串流。

不需系統 ffmpeg:抓 bestaudio 的單一串流(不做 yt-dlp 後處理),再用 PyAV(內含 ffmpeg 函式庫)
解碼 → 以 soundfile 寫出目標格式。
"""

from __future__ import annotations

import glob
import logging
import os
import tempfile
from typing import Any, Callable, Optional

logger = logging.getLogger("autolyrics.fetch")

try:
    import yt_dlp  # type: ignore
    _HAS = True
except Exception:  # pragma: no cover
    yt_dlp = None  # type: ignore
    _HAS = False


def is_available() -> bool:
    return _HAS


def _looks_like_url(s: str) -> bool:
    s = (s or "").strip().lower()
    return s.startswith("http://") or s.startswith("https://")


def fetch_audio(url: str, out_path: str, fmt: str = "wav",
                progress: Optional[Callable[[str, float, str], None]] = None) -> dict:
    """下載 URL 的最佳音訊 → 寫成 fmt 到 out_path。回 {title,duration,uploader,sr,fmt}。
    任何失敗都丟例外給呼叫端(由 API 轉成 4xx/5xx 並清檔)。"""
    if not _HAS:
        raise RuntimeError("yt-dlp 未安裝 —— URL 下載器不可用")
    if not _looks_like_url(url):
        raise ValueError("請貼上有效的網址(http/https)")

    tmpdir = tempfile.mkdtemp(prefix="fetchdl_")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": os.path.join(tmpdir, "dl.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
        "nocheckcertificate": False,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:  # type: ignore[union-attr]
            info = ydl.extract_info(url, download=True)
        if isinstance(info, dict) and info.get("entries"):  # 播放清單 → 取第一個
            info = info["entries"][0]
        files = sorted(glob.glob(os.path.join(tmpdir, "dl.*")), key=os.path.getsize, reverse=True)
        if not files:
            raise RuntimeError("下載沒有產生音訊檔")
        downloaded = files[0]

        # 解碼(PyAV 內含 ffmpeg)→ 寫出目標格式
        from . import mastering as M
        from . import tools as T
        data, sr = M._load_audio(downloaded)
        fmt = (fmt or "wav").lower()
        if fmt not in T._ENCODE_EXT:
            fmt = "wav"
        T._encode(data, sr, out_path, fmt)
        return {
            "title": str(info.get("title", "audio")) if isinstance(info, dict) else "audio",
            "duration": float(info.get("duration", 0) or 0) if isinstance(info, dict) else 0.0,
            "uploader": str(info.get("uploader", "")) if isinstance(info, dict) else "",
            "sr": int(sr),
            "fmt": fmt,
        }
    finally:
        try:
            for f in glob.glob(os.path.join(tmpdir, "*")):
                os.unlink(f)
            os.rmdir(tmpdir)
        except OSError:
            pass


def fetch_ext(fmt: str) -> str:
    from . import tools as T
    return T._ENCODE_EXT.get((fmt or "wav").lower(), "wav")
