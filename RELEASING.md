# Releasing AutoLyrics

A concise runbook for cutting a signed, auto-updating desktop release.

AutoLyrics ships in-app auto-update via Tauri v2's official (signed) updater. On
startup the app fetches a `latest.json` from the GitHub release, compares its
`version` to the running build, and — if newer — downloads the signed installer,
verifies it against the bundled public key, installs it, and relaunches. After
relaunch the Rust shell notices the new app version (the `.autolyrics_src_ok`
sentinel in the WORK backend dir no longer matches) and **re-copies the bundled
Python backend source** into the writable WORK dir, preserving `.venv`, `models`,
and outputs — so the backend code updates together with the shell.

> Platform note: these steps describe the **Windows** release (NSIS `*-setup.exe`
> for the updater, plus the `*.msi` for manual installs). The updater target key
> is `windows-x86_64`.

---

## 0. One-time setup (per machine)

The updater verifies every download against a minisign key pair.

- **Public key** — committed in `frontend/src-tauri/tauri.conf.json` under
  `plugins.updater.pubkey`. It is safe to publish.
- **Private key** — `frontend/.tauri-keys/autolyrics.key` (+ `autolyrics.key.pub`).
  **This is a SECRET.** It is **gitignored** (`.tauri-keys/` and `*.key` in the
  root `.gitignore`) and must NEVER be committed. Keep a secure backup — if it is
  lost, existing installs can no longer auto-update (a new key means a new app
  identity and a manual reinstall for every user).

The key was generated once with:

```bash
# (already done — do NOT regenerate unless you intend to break auto-update)
npx tauri signer generate -w frontend/.tauri-keys/autolyrics.key
```

This repo's key was created with an **empty passphrase**, so
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is set to an empty string at build time.

---

## 1. Bump the version

Update the version in **both** files so the shell, the bundle, and the manifest
all agree (the updater compares `latest.json.version` against the bundled app
version, so a mismatch means no update is ever offered):

- `frontend/src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
- `frontend/package.json` → `"version": "X.Y.Z"`

> `frontend/src-tauri/Cargo.toml` also carries a `version`; keep it in sync too
> for tidy `cargo`/`tauri info` output (it does not drive the updater).

Use plain SemVer (`0.2.0`), no leading `v`. The git tag gets the `v` (`v0.2.0`).

Write the release notes for this version into a `NOTES.md` at the repo root
(`make-latest-json.mjs` reads it by default). Keep it short — it is shown in the
in-app update banner.

---

## 2. Build the signed bundle

From `frontend/`, with the signing env vars set, run the Tauri build. The private
key path and the (empty) password must be exported so Tauri produces the `.sig`
artifacts (`bundle.createUpdaterArtifacts` is already `true` in `tauri.conf.json`).

PowerShell (Windows):

```powershell
cd C:\dev\LocalAiLyrics\frontend
$env:TAURI_SIGNING_PRIVATE_KEY = "$PWD\.tauri-keys\autolyrics.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run tauri build
```

Bash (Git Bash):

```bash
cd /c/dev/LocalAiLyrics/frontend
export TAURI_SIGNING_PRIVATE_KEY="$PWD/.tauri-keys/autolyrics.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build
```

> `TAURI_SIGNING_PRIVATE_KEY` may be either the **path** to the key file or the
> key's **contents** — Tauri accepts both. Using the path is simplest here.

Artifacts land under
`frontend/src-tauri/target/release/bundle/`:

- `nsis/AutoLyrics_<version>_x64-setup.exe`        ← the updater installer
- `nsis/AutoLyrics_<version>_x64-setup.exe.sig`    ← its detached signature
- `msi/AutoLyrics_<version>_x64_en-US.msi`         ← manual-install MSI

If the `.sig` files are missing, the signing env vars were not set — fix and
rebuild before proceeding.

---

## 3. Generate `latest.json`

From the repo root, run the manifest generator. It reads the version from
`tauri.conf.json`, finds the NSIS `*-setup.exe` + its `.sig`, embeds the signature,
and writes the GitHub download URL. **`--date` is required** (the script never
calls `Date.now()`, so output is reproducible) — use the moment you publish.

```bash
node scripts/make-latest-json.mjs \
  --date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --notes-file NOTES.md
```

PowerShell equivalent for `--date`:

```powershell
node scripts/make-latest-json.mjs --date (Get-Date -AsUTC -Format "yyyy-MM-ddTHH:mm:ssZ") --notes-file NOTES.md
```

By default it writes
`frontend/src-tauri/target/release/bundle/latest.json`. Useful overrides:

| Flag             | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `--version X.Y.Z`| override the version (default: from `tauri.conf.json`)      |
| `--tag vX.Y.Z`   | tag used in the download URL (default: `v<version>`)       |
| `--notes "..."`  | inline release notes (instead of `--notes-file`)           |
| `--repo o/r`     | GitHub `owner/repo` (default: `AriesHongHuanWu/LocalAiLyrics`) |
| `--out PATH`     | output path for `latest.json`                              |
| `--setup PATH`   | explicit installer path (skips auto-discovery)             |

Inspect the result — confirm `version`, `url`, and a non-empty `signature`:

```bash
cat frontend/src-tauri/target/release/bundle/latest.json
```

The `url` MUST be the exact filename you will upload, under the tag you will
create:
`https://github.com/AriesHongHuanWu/LocalAiLyrics/releases/download/v<version>/<setup.exe>`

---

## 4. Create the GitHub release and upload assets

Create a release tagged **`v<version>`** and upload exactly these three files:

1. `AutoLyrics_<version>_x64-setup.exe`      (the updater installer)
2. `AutoLyrics_<version>_x64_en-US.msi`      (manual install)
3. `latest.json`                             (the updater manifest)

### Option A — GitHub CLI (`gh`)

```bash
cd C:/dev/LocalAiLyrics
BUNDLE=frontend/src-tauri/target/release/bundle
gh release create v0.2.0 \
  "$BUNDLE/nsis/AutoLyrics_0.2.0_x64-setup.exe" \
  "$BUNDLE/msi/AutoLyrics_0.2.0_x64_en-US.msi" \
  "$BUNDLE/latest.json" \
  --title "AutoLyrics v0.2.0" \
  --notes-file NOTES.md
```

### Option B — GitHub web UI

1. Repo → **Releases** → **Draft a new release**.
2. **Choose a tag** → type `v0.2.0` → **Create new tag on publish**.
3. Title `AutoLyrics v0.2.0`; paste the notes.
4. Drag the three files into the assets area.
5. Ensure **Set as the latest release** is checked, then **Publish**.

> **Critical — the `latest` pointer.** The updater endpoint is
> `https://github.com/AriesHongHuanWu/LocalAiLyrics/releases/latest/download/latest.json`.
> GitHub resolves `/releases/latest/` to the release marked **"Latest"**. So the
> newest release MUST be flagged as latest (it is by default for the highest
> non-prerelease SemVer tag). Do **not** mark the release as a *pre-release* or
> the updater will keep serving the previous `latest.json`. If you ever hotfix an
> older line, publish it without the "latest" flag.

---

## 5. Verify the update path

1. Install the **previous** version on a test machine (or keep an older install).
2. Launch it. Within a few seconds the in-app update banner should appear
   ("Update available — v<version>"). The Settings → App updates row also has a
   manual **Check for updates** button.
3. Click **Update now**. Watch it download (progress bar), install, and relaunch
   into the new version.
4. After relaunch, confirm the version chip (top status strip) shows the new
   version, and that the backend still works (the WORK backend source is
   refreshed automatically; the existing `.venv` and models are preserved).

If the banner never appears, check (in order):

- `latest.json` is reachable at the `/releases/latest/download/latest.json` URL
  and its `version` is strictly greater than the installed app's version.
- The release is flagged **Latest** (not pre-release).
- The `signature` in `latest.json` matches the uploaded `*-setup.exe.sig`, and the
  installer URL points to the actually-uploaded filename.
- The installed app's `tauri.conf.json` `plugins.updater.pubkey` matches the key
  that signed this build (a key change breaks verification → silent no-update).

---

## Quick checklist

- [ ] Bumped `version` in `tauri.conf.json` **and** `package.json` (and `Cargo.toml`).
- [ ] Wrote `NOTES.md`.
- [ ] Set `TAURI_SIGNING_PRIVATE_KEY` (path to `.tauri-keys/autolyrics.key`) + empty `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- [ ] `npm run tauri build` produced `*-setup.exe`, `*-setup.exe.sig`, and `*.msi`.
- [ ] Ran `node scripts/make-latest-json.mjs --date ... --notes-file NOTES.md`; inspected output.
- [ ] Created release `v<version>`; uploaded setup.exe + .msi + latest.json.
- [ ] Release is flagged **Latest**.
- [ ] Verified an old install auto-updates.

> Never commit `frontend/.tauri-keys/` or any `*.key`. Back the private key up
> somewhere safe and offline.
