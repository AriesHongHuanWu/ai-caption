# Local Studio v0.1.29

🎚️ **AI stem mastering** — the headline feature. AI splits your mix into **drums, bass, vocals and other**, you rebalance their levels, and the result is mastered. Rescue a buried vocal or a boomy low end the way iZotope Ozone's Master Rebalance does — fully local, free.

### New — AI stem rebalance (Demucs)
Open **Pro 進階** → **AI 分軌重新平衡 (Demucs)**:
- AI (Demucs) separates the mix into **🥁 Drums · 🎸 Bass · 🎤 Vocals · 🎹 Other**.
- Set each stem's level (±12 dB), and the rebalanced mix is mastered as usual.
- Runs on your GPU (falls back to CPU); takes ~1–3 minutes, with a live progress bar.
- After the master, a chip confirms exactly what was applied (e.g. "🎚️ Stems rebalanced: 🎤 Vocals +6 · 🎸 Bass −4").

This completes the AI mastering pair with the v0.1.28 genre detection.

### Built carefully (16-finding adversarial review)
Shipped after a deep review of the feature. The fixes that matter:
- **Honest A/B** — the "before" you compare against is now your **true original**, not the AI's lossy reconstruction, and it's correctly loudness-matched to the master.
- **No distortion from big boosts** — the rebalanced mix is gain-staged back to a sane level before compression/saturation, so a +12 dB stem boost doesn't drive the chain into clipping.
- **No wasted time** — if every stem is left at 0 dB, the multi-minute separation is skipped entirely.
- **Honest feedback** — if AI separation is unavailable, the toggle is disabled with an explanation, and you're told plainly if a run was skipped (instead of silently mastering the original).
- **Stable under load** — separation is serialized (one at a time) with a VRAM pre-check, so it can't race the model or exhaust an 8 GB GPU.

### Unchanged
- EQ automation lanes, manual multiband, adaptive EQ, Pro parametric EQ, genre detection, A/B + three-way comparison, and download all work as before.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
