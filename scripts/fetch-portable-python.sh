#!/usr/bin/env bash
# Fetch a python-build-standalone interpreter and stage it for Tauri bundling
# (macOS / Linux). This is what makes Ai Caption "portable Python": the
# interpreter is bundled into the installer so end users do NOT need to install
# Python. Run BEFORE `tauri build`; CI runs it automatically. If skipped, the app
# gracefully falls back to system Python.
#
# Env overrides: PYVERSION (default 3.12), TAG (pin a release date), DEST,
#                TRIPLE_OVERRIDE.
set -euo pipefail

PYVERSION="${PYVERSION:-3.12}"
TAG="${TAG:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="${DEST:-$REPO_ROOT/frontend/src-tauri/resources/python}"

OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS-$ARCH" in
  Darwin-arm64)   TRIPLE="aarch64-apple-darwin" ;;
  Darwin-x86_64)  TRIPLE="x86_64-apple-darwin" ;;
  Linux-x86_64)   TRIPLE="x86_64-unknown-linux-gnu" ;;
  Linux-aarch64)  TRIPLE="aarch64-unknown-linux-gnu" ;;
  *) echo "Unsupported platform: $OS-$ARCH" >&2; exit 1 ;;
esac
TRIPLE="${TRIPLE_OVERRIDE:-$TRIPLE}"

API="https://api.github.com/repos/astral-sh/python-build-standalone/releases"
if [ -n "$TAG" ]; then URL="$API/tags/$TAG"; else URL="$API/latest"; fi

echo "-> Querying python-build-standalone release (${TAG:-latest})..."
# Fetch the release JSON. Pass the token only when present (no empty-array
# expansion, which is unsafe under set -u on bash 3.2 / macOS).
if [ -n "${GITHUB_TOKEN:-}" ]; then
  JSON="$(curl -fsSL -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "User-Agent: ai-caption-fetch" "$URL")"
else
  JSON="$(curl -fsSL -H "User-Agent: ai-caption-fetch" "$URL")"
fi

# Resolve the asset URL with Python. IMPORTANT: feed the JSON via a FILE, not
# stdin. `python3 - <<'PY'` already consumes stdin for the *script itself*, so
# piping JSON to stdin gets swallowed by the heredoc (that was the original bug:
# empty JSON -> JSONDecodeError on every unix runner).
JSON_FILE="$(mktemp)"
printf '%s' "$JSON" > "$JSON_FILE"
export MATCH_PYVER="$PYVERSION" MATCH_TRIPLE="$TRIPLE" MATCH_JSON="$JSON_FILE"
ASSET_URL="$(python3 - <<'PY'
import os, re, json
with open(os.environ["MATCH_JSON"], encoding="utf-8") as f:
    rel = json.load(f)
pyver = re.escape(os.environ["MATCH_PYVER"])
triple = re.escape(os.environ["MATCH_TRIPLE"])
pat = re.compile(rf"cpython-{pyver}\.\d+\+\d+-{triple}-install_only\.tar\.gz$")
for a in rel.get("assets", []):
    if pat.match(a["name"]):
        print(a["browser_download_url"]); break
PY
)"

if [ -z "$ASSET_URL" ]; then
  TAGNAME="$(python3 -c 'import json,os;print(json.load(open(os.environ["MATCH_JSON"])).get("tag_name","?"))' 2>/dev/null || echo '?')"
  rm -f "$JSON_FILE"
  echo "No python-build-standalone asset matched cpython-${PYVERSION}.*-${TRIPLE}-install_only.tar.gz in release $TAGNAME" >&2
  echo "(First 300 chars of API response: $(printf '%s' "$JSON" | head -c 300))" >&2
  exit 1
fi
rm -f "$JSON_FILE"

echo "-> $ASSET_URL"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL -H "User-Agent: ai-caption-fetch" "$ASSET_URL" -o "$TMP/py.tar.gz"
tar -xzf "$TMP/py.tar.gz" -C "$TMP"
if [ ! -x "$TMP/python/bin/python3" ]; then
  echo "Extraction missing python/bin/python3" >&2; exit 1
fi

mkdir -p "$DEST"
# Clear any previous interpreter but preserve .gitkeep.
find "$DEST" -mindepth 1 -not -name .gitkeep -exec rm -rf {} + 2>/dev/null || true
cp -a "$TMP/python/." "$DEST/"
echo "[OK] Portable Python staged at $DEST ($("$DEST/bin/python3" --version 2>&1))"
