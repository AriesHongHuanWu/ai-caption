# Ai Caption v0.1.6

A new switchable **Precision mode** for noticeably more accurate lyrics/subtitles — old behaviour stays one click away.

### New
- **🎯 Precision mode** (精準模式) — a toggle on the 辨識 page (both 歌曲歌詞 and 影片字幕). When on, decoding is tuned for singing and long audio:
  - **Hotword biasing from your reference lyrics** — and crucially it's **re-applied to every 30-second window**, unlike the old prompt which only nudged the first ~30s and then faded. This is the big fix for "I pasted some lyrics but it still got them wrong" on longer songs.
  - **Anti-hallucination** — suppresses the repeat/loop "rambling" Whisper tends to do on sung vocals.
  - **Wider beam search** — explores more candidates on tricky passages.
  - Slower, but more accurate. **Off by default** — flip it on when you want the extra accuracy; everything else behaves exactly as before.

### Tip for best accuracy
- If you have the **complete** lyrics, use **強制對齊 (Forced align)** — it takes your lyrics as the truth and only solves the timing, so the words are 100% right. Precision mode helps most when you only have **partial** lyrics or none.

### Unchanged
- 100% local — nothing is uploaded. Runs on no-GPU laptops (CPU int8 / Intel Core Ultra).

If you'd like to support development: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
