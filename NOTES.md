# Ai Caption v0.1.5

Choose where the heavy stuff lives — put the engine and models on the drive you want.

### New
- **🗂️ Choose your data drive** (Settings → 資料儲存位置). Running low on C:? Point Ai Caption at a roomier drive (e.g. D:) and the engine, downloaded models and caches all live there instead. Pick a folder, confirm, and the app restarts to apply — the first-run wizard then sets up at the new location and future model downloads land on that drive. Existing data isn't moved (the old location is left untouched for you to remove if you like). On the default location, nothing changes — behaviour is exactly as before.

### About choosing models
- You already pick exactly which models to download in **Settings → 模型管理 (Model Manager)** — download or remove each one individually (Whisper sizes, Demucs, aligner, LaMa). Since v0.1.4 the health check no longer auto-pulls everything; it only fetches what the mode you're using needs, so nothing large downloads without you asking.

### Unchanged
- 100% local — nothing is uploaded. Runs on no-GPU laptops (CPU int8 / Intel Core Ultra).

If you'd like to support development: ☕ [Ko-fi](https://ko-fi.com/arieswu) · [PayPal](https://paypal.me/Arieshonghuan) · [GitHub Sponsors](https://github.com/sponsors/AriesHongHuanWu).

MIT © 2026 Aries HongHuan Wu.
