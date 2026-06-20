# Local Studio v0.1.15

Smarter, lighter model setup — download only the model that suits **your** machine, never all of them.

### Changed
- **🎯 No more bulk model installs** — the health/repair banner used to say "立即修復" and then quietly download **every** model (several GB), even ones your device will never use. Now repair only restores genuinely-missing **program components** (Python packages); AI models are treated as on-demand and are **never** bulk-installed behind a single click. Big disk savings, no surprise multi-GB downloads.
- **🧠 Device-aware model picker in Settings** — Settings → 模型 now shows **your hardware** (GPU · VRAM · CUDA · CPU · RAM), tells you in plain language **which Whisper model fits this machine**, and lets you download just that one with a single click. The same smart recommendation you saw on first run is now always available.
- **📦 Simpler, smaller first run** — the speech (Demucs) and alignment models are now marked optional and download themselves automatically the first time a feature actually needs them. A fresh install no longer pre-pulls models you may not use.

### Why
Several users (rightly) pointed out that the "repair" button installed *all* models at once — wasteful on disk and bandwidth. Models should be a choice, matched to your device, not an all-or-nothing download.

### Unchanged
- All v0.1.13 features (Auto-Mastering with section dynamics + advanced controls, redesigned sidebar) and the v0.1.14 reliable-update fix, as before.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
