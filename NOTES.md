# Local Studio v0.1.37

🎚️ **A much stronger Mastering engine + style/artist presets**, a cleaner Toolbox, and more precise song-structure analysis.

### Mastering — now actually transformative
- **Fixed: mastering wasn't improving the track.** Picking a specific style used to *disable* the smart corrective chain, so you got a gentle, non-transformative master (score in ≈ score out). Now **every preset runs the intelligent corrective + residual EQ** that genuinely fixes tonal balance — the preset layers its *character* on top. On a flawed mix this moves the score dramatically; a well-balanced mix keeps its score and just takes on the style.
- **21 presets in 3 groups:**
  - **Genres** — Auto / Pop / Hip-Hop / EDM / Rock / R&B / Acoustic / Ballad / Lo-fi
  - **Hip-Hop styles** — Melodic Rap / Old-school Boom-bap / Trap 808 / Drill / Cloud Rap
  - **Artist-inspired styles** — Juice WRLD / XXXTENTACION / Drake / Kanye / Travis Scott / The Weeknd / Playboi Carti *(stylistic references — not official or endorsed)*
- **Save your own presets** — name your current style + advanced settings and recall them on any track ("My presets").

### Toolbox — file first
- The **file picker now sits at the top**; pick a tool below.

### Song analysis — more precise structure
- Verse / pre-chorus / chorus / bridge / intro / outro detection improved with timbre features (spectral centroid + flatness), prominence-based boundary picking, and an adaptive clustering threshold.

### Downloader (from v0.1.36) — hardened
- Large video downloads now stream from disk (no out-of-memory), temp files clean up on failed downloads, and a few small correctness fixes.

> Note: the **Downloader + song analysis** need the local engine to include `yt-dlp`. If you updated from an older version and the **Download** mode shows an "engine missing" notice, re-run Settings → repair/reinstall engine once. **Mastering and the Toolbox work immediately after updating** — no repair needed.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
