# Local Studio v0.1.34

🧰 **New mode: Audio Toolbox** — a growing set of handy audio tools, including the **de-ess analyzer** you asked for (it tells you *which frequency to filter*). 11 tools to start, and the framework makes adding more trivial.

### New — 音訊工具箱 (Audio Toolbox)
A new tool under **Audio**, organised into categories. Pick a tool, drop a file, run:

**Analyze** (gives you info)
- 🎙️ **De-ess analyzer** — finds the real sibilance frequency in a vocal and recommends exactly which band to filter + the threshold (e.g. "*sibilance at ~7 kHz → de-ess 5.5–9.2 kHz, threshold −20 dB*").
- 📊 **Loudness meter** — LUFS / true-peak / crest vs streaming targets (Spotify −14, Apple −16, Club −9), to QC before upload.
- 🎵 **Key & BPM** — detect a song's musical key and tempo (great for sampling, remixing, DJ matching).

**Loudness / Repair / Edit / Stereo / Export**
- 🎚️ **Loudness normalizer** — to a target LUFS, peak-safe.
- ⚡ **Hum removal** — kill 50/60 Hz mains hum + harmonics.
- 🌬️ **Noise reduction** — spectral gate for steady background noise (voice/recordings).
- ✂️ **Silence trim**, 📈 **Fade in/out**, ↔️ **Stereo width / mono**, ✛ **DC removal + normalize**.
- 🔊 **Format converter** — WAV / FLAC / MP3 / OGG.

Everything runs locally (license-clean numpy/scipy/pyloudnorm/libsndfile). More tools will keep landing in this Toolbox.

### Unchanged
- Mastering, lyrics, subtitles, text removal, and the categorized + pinnable sidebar all work as before.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
