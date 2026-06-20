# Local Studio v0.1.25

🎚️ **Adaptive EQ, refined to mastering-engineer quality** — after a deep adversarial review of v0.1.24's automation, the adaptive EQ was rebuilt so it behaves like a real engineer riding the EQ, not a machine over-correcting. Plus a pipeline-wide safety fix.

### Adaptive EQ — now Ozone-class
The automation that rides the song is the same idea, done right:
- **Rides toward the song's *own* average tone**, not a fixed genre curve. So it only tames a section that drifts from the rest of the track (a muddy verse, a harsh chorus) and leaves consistent sections alone — it no longer fights the genre correction or a reference match, and no longer flattens deliberate section contrast.
- **Silence-safe energy gate** — quiet intros, breaths, reverb tails and fade-outs are left untouched (measured: ~1000× less movement in silence). No more pumping the noise floor.
- **Gentle, slow, musical** — per-band motion is capped low (~Ozone-level ±1–2 dB) with a total-movement budget and slower smoothing, so the tone never lurches or breathes.
- **Cleaner filtering** — each band now corrects exactly the frequency range it measured, with **zero-phase** filters so the result matches the curve (no phase smear from overlapping bands).

### Pipeline safety (all modes)
- **No more corrupt/silent exports**: a malformed source file (or any NaN/Inf in the chain) can no longer poison the output — the engine now scrubs non-finite samples at input and guarantees a finite WAV at output. This protects every mode, not just mastering.

### Under the hood
This release applied the confirmed findings of a 4-dimension adversarial review (DSP correctness, robustness, musicality, chain integration), with each finding independently verified before fixing. Adaptive EQ is also now much faster.

### Unchanged
- The v0.1.24 Pro parametric EQ, auto mode, dynamic EQ, loudness-matched A/B + three-way comparison, and download all work as before.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
