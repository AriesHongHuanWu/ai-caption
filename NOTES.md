# Local Studio v0.1.14

Fix: in-app updates no longer fail with "Error opening file for writing".

### Fixed
- **🔧 Reliable updates** — when installing an update, the app now **shuts the local engine down first**, then installs. Previously a still-running engine process could keep the bundled Python's files open, so the installer hit `Error opening file for writing … python\DLLs\…` and you had to Retry/Abort. The updater now downloads, stops the engine, *then* overwrites — cleanly. (The engine restarts itself after the update.)

### Note
- This takes effect for updates **from v0.1.14 onward**. If a previous update got stuck on that error, just re-run the latest installer once — it installs fine when no engine is running.

### Unchanged
- All v0.1.13 features (Auto-Mastering with section dynamics + advanced controls, redesigned sidebar) as before.

Support: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
