# Local Studio v0.1.24

🌊 **Adaptive EQ — automation that rides the song** + 🎛️ **Pro: a fully-parametric EQ**. This is what a high-end mastering engineer does by hand: an EQ that changes through the track so *every* section sounds right, plus deep per-band control with phase and Mid/Side routing.

### New — Adaptive EQ (auto automation)
Turn on **適應性 EQ · auto automation** (in the Pro panel) and the corrective EQ stops being one fixed curve. Instead it:
- slices the song into overlapping time windows,
- measures the tone of each window against the target,
- and **rides the EQ section by section** — tame a dull/muddy verse, soften a harsh chorus, then let go where the mix is already good.

It's the equivalent of an engineer automating the EQ across the whole song, done automatically. Verified on real audio: on a track that switches between a dark verse and a bright chorus, the high-mid correction rides ~2 dB between sections (gentle in the verse, full cut in the chorus) — it genuinely follows the music. The new **適應EQ** stage shows in the signal chain whenever it's active.

### Pro — fully-parametric EQ
Open **Pro 進階:全參數 EQ** for a real parametric EQ:
- **Draggable response curve** — grab a band node and drag (freq ↔ x, gain ↔ y); the curve updates instantly.
- **Unlimited bands**, each with its own:
  - **Type** — Bell · Low/High shelf · High-pass · Low-pass · Notch · All-pass
  - **Frequency · Gain · Q**
  - **Phase** — **Natural (minimum-phase)** or **Linear-phase** (zero phase distortion), *per band*
  - **Channel** — **Stereo · Mid · Side · Left · Right**

### Notes
- Both run as their own stages in the signal chain, on top of the automatic correction.
- More Pro automation (manual EQ-automation lanes, per-band multiband) is coming next.

### Unchanged
- Auto mode, dynamic EQ, the loudness-matched A/B + three-way comparison, and the download all work as before.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
