# Ai Caption v0.1.9

Accuracy upgrade — better words *and* tighter timing, with captions/karaoke that snap to the beat.

### Improved
- **🎯 Precision mode is now stronger** (the 精準模式 toggle):
  - **Cleaner vocal separation** — on GPU with enough memory, Demucs runs with test-time augmentation, giving Whisper a cleaner vocal track to read → fewer wrong words. (VRAM-aware: skipped automatically when the GPU is tight, so it won't cause out-of-memory.)
  - **Tighter word timing** — word starts are snapped to the actual vocal onsets on the recognition path too (forced-align already did this), so dynamic captions and karaoke land right on the beat.
- **⏱️ Steadier per-word timing everywhere** — word timestamps are now cleaned up in **every mode**: no overlaps, no out-of-order or zero-length words, each word gets a sensible minimum length. This makes the **動態字幕燒錄** highlight stop flickering and track the words precisely.

### Notes
- Forced-align timing is left exactly as-is (it's already accurate) — the cleanup only repairs broken cases.
- Precision off = unchanged behaviour, just with the universal timing cleanup applied.

### Unchanged
- 100% local — nothing is uploaded. All v0.1.8 stability + features as before.

If you'd like to support development: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
