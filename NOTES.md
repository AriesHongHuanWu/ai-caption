# Local Studio v0.1.12

🎚️ **New: Auto-Mastering** — turn a mix into a release-ready master, 100% locally. And the app is now **Local Studio**.

### New
- **🎚️ Auto-Mastering (母帶) mode** — drop a mix and the local DSP chain makes it sound finished:
  - **Genre presets** — Pop · Hip-Hop · EDM · Rock · R&B · Acoustic · Ballad · Lo-fi (each with a tuned EQ + compression character), or **Auto**.
  - **Reference track** (optional) — upload a song you want to sound like; it matches that track's tonal balance (FFT-matched EQ).
  - **Loudness target** — **Streaming** (−14 LUFS) · **Balanced** (−12) · **Social** (−9, punchier for phones) — all true-peak-limited so nothing clips.
  - Chain: tonal EQ → compression → stereo width → loudness-normalize → brickwall limiter → **24-bit WAV**. A/B the original vs master, see the loudness/peak numbers, and download.
- **🏷️ Renamed to “Local Studio”** — it's now a full local AI studio (lyrics · subtitles · text removal · mastering). A 4th mode joins the (icon-only) switcher.

### Notes
- Mastering needs two small extra packages (scipy + pyloudnorm). If the 母帶 mode says they're missing, open **Settings → 修復** to install them.
- The internal app identifier is unchanged, so your auto-updates keep working.

### Unchanged
- 100% local — nothing is uploaded. All v0.1.11 features + the backend-restart fix as before.

Support development: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
