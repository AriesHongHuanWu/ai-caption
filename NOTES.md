# Ai Caption v0.1.4

Each mode now gets its own tailored interface — and Clean Text can erase text or objects that **move** through the frame.

### New
- **🎬 Per-mode interfaces** — the app now reshapes itself around what you're doing:
  - **🎵 Song lyrics** keeps the full word-level editor.
  - **🎬 Video → Subtitles** gets a dedicated **video-editor-style** workspace — preview alongside an editable cue list (edit text, nudge start/end by ±0.1 s, click a cue to seek, active cue highlighted; falls back gracefully for audio-only sources).
  - **🧹 Clean Text** collapses to just the steps it needs (no more lyric/subtitle tabs cluttering it).
- **✨ Moving text/object removal** — Clean Text now offers **固定** (fixed position) or **會移動 (追蹤)**: draw the box once on the first frame and Ai Caption **tracks the region as it moves** through the video, erasing it frame-by-frame with LaMa inpainting.

### Fixed
- Version number now reads the **real app version** (it was showing a stale value).
- **Mode switcher is icon-only** — no more cramped, truncated labels.
- Health check **no longer downloads all three models** up front — it only fetches what the mode you're using actually needs.

### Unchanged
- 100% local — nothing is uploaded. Runs on no-GPU laptops (CPU int8 / Intel Core Ultra).

If you'd like to support development: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
