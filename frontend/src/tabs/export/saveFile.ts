/* ──────────────────────────────────────────────────────────────────
   Tab-local save-to-disk helper. Prefers the Tauri dialog + fs APIs
   when running inside the desktop shell (Phase 3); falls back to a
   browser <a download> otherwise.

   IMPORTANT (Tauri v2): plugin guest-JS bindings (dialog/fs) are NOT
   attached to window.__TAURI__ by `withGlobalTauri` — that only exposes
   the CORE API. The plugin functions ship in their own npm packages
   (@tauri-apps/plugin-dialog, @tauri-apps/plugin-fs) and MUST be
   imported in JS. We therefore import them statically and feature-detect
   "are we in Tauri" via the reliable `__TAURI_INTERNALS__` global
   (present iff running inside the Tauri webview). In a plain browser the
   imports load harmlessly but are never called.
   ────────────────────────────────────────────────────────────────── */

import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { downloadDir, join } from '@tauri-apps/api/path';
import type { ExportFormat } from '../../api/types';

interface TauriInternalsWindow {
  __TAURI_INTERNALS__?: unknown;
}

/** True when running inside the Tauri webview (v2 reliable signal). */
export function hasTauri(): boolean {
  const w = window as unknown as TauriInternalsWindow;
  return '__TAURI_INTERNALS__' in w && w.__TAURI_INTERNALS__ != null;
}

const EXT_FILTER: Record<ExportFormat, { name: string; extensions: string[] }> = {
  lrc: { name: 'LRC lyrics', extensions: ['lrc'] },
  srt: { name: 'SubRip subtitles', extensions: ['srt'] },
  webvtt: { name: 'WebVTT subtitles', extensions: ['vtt'] },
  ass: { name: 'ASS karaoke', extensions: ['ass'] },
  json: { name: 'JSON result', extensions: ['json'] },
};

export type SaveOutcome =
  | { kind: 'tauri'; path: string }
  | { kind: 'download' }
  | { kind: 'cancelled' };

/**
 * Save text to disk. Inside Tauri this opens a native save dialog and
 * writes the file; in the browser it triggers a download of the blob.
 */
export async function saveText(
  text: string,
  filename: string,
  fmt: ExportFormat,
  mime: string,
): Promise<SaveOutcome> {
  if (hasTauri()) {
    const path = await save({
      defaultPath: filename,
      filters: [EXT_FILTER[fmt]],
    });
    if (!path) return { kind: 'cancelled' };
    await writeTextFile(path, text);
    return { kind: 'tauri', path };
  }
  downloadBlob(new Blob([text], { type: mime }), filename);
  return { kind: 'download' };
}

/**
 * Save a binary file FETCHED from a backend URL (e.g. the mastered WAV).
 *
 * The naive `<a href=resultUrl download>` fails in the desktop app: the
 * result URL is cross-origin (the local backend on :8756), and webviews
 * ignore the `download` attribute for cross-origin hrefs AND block
 * navigating to external http — so nothing saves. We instead `fetch` the
 * bytes (fetch is not blocked) and write them via the Tauri save dialog
 * (binary `writeFile`) or a same-origin blob download in the browser.
 */
export async function saveBinaryUrl(
  url: string,
  filename: string,
  filter: { name: string; extensions: string[] } = { name: 'WAV audio', extensions: ['wav'] },
): Promise<SaveOutcome> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (hasTauri()) {
    const path = await save({ defaultPath: filename, filters: [filter] });
    if (!path) return { kind: 'cancelled' };
    await writeFile(path, bytes);
    return { kind: 'tauri', path };
  }
  downloadBlob(new Blob([bytes], { type: res.headers.get('content-type') || 'application/octet-stream' }), filename);
  return { kind: 'download' };
}

/** Save an in-memory Blob: native save dialog (binary writeFile) in Tauri, else browser download. */
export async function saveBinaryBlob(
  blob: Blob,
  filename: string,
  filter: { name: string; extensions: string[] } = { name: 'Audio', extensions: ['wav'] },
): Promise<SaveOutcome> {
  if (hasTauri()) {
    const path = await save({ defaultPath: filename, filters: [filter] });
    if (!path) return { kind: 'cancelled' };
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return { kind: 'tauri', path };
  }
  downloadBlob(blob, filename);
  return { kind: 'download' };
}

/* ──────────────────────────────────────────────────────────────────
   Downloader extras — persist to a known folder so the file has a real
   on-disk PATH (needed for native drag-out + reveal-in-folder). Browser
   has no filesystem path, so these are Tauri-only (callers feature-gate).
   ────────────────────────────────────────────────────────────────── */
const DL_SUBDIR = 'Local Studio';

/** Folder the Downloader writes into: <Downloads>/Local Studio (created on demand). */
async function downloadsFolder(): Promise<string> {
  const dir = await downloadDir();
  const folder = await join(dir, DL_SUBDIR);
  try { await mkdir(folder, { recursive: true }); } catch { /* already exists */ }
  return folder;
}

/** Write a Blob into <Downloads>/Local Studio and return its absolute path (Tauri only). */
export async function saveBlobToDownloads(blob: Blob, filename: string): Promise<string> {
  const folder = await downloadsFolder();
  const full = await join(folder, filename);
  await writeFile(full, new Uint8Array(await blob.arrayBuffer()));
  return full;
}

/** Reveal (highlight) a saved file in the OS file manager. Returns false if unavailable. */
export async function revealPath(path: string): Promise<boolean> {
  if (!hasTauri()) return false;
  try {
    const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
    await revealItemInDir(path);
    return true;
  } catch (e) {
    console.warn('reveal-in-folder unavailable', e);
    return false;
  }
}

// 1×1 transparent PNG — a valid drag image (cosmetic; the OS shows the filename).
const DRAG_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
let dragIconPath: string | null = null;
async function ensureDragIcon(): Promise<string> {
  if (dragIconPath) return dragIconPath;
  const folder = await downloadsFolder();
  const p = await join(folder, '.al-dragicon.png');
  if (!(await exists(p))) {
    const bin = Uint8Array.from(atob(DRAG_ICON_B64), (c) => c.charCodeAt(0));
    await writeFile(p, bin);
  }
  dragIconPath = p;
  return p;
}

/**
 * Start a native OS drag-out of a saved file (drag straight into a DAW).
 * Uses the third-party @crabnebula/tauri-plugin-drag; loaded lazily and
 * fully guarded so any failure degrades to the reveal-in-folder path.
 * Returns true if the drag started.
 */
export async function dragOutPath(path: string): Promise<boolean> {
  if (!hasTauri()) return false;
  try {
    const { startDrag } = await import('@crabnebula/tauri-plugin-drag');
    let icon = '';
    try { icon = await ensureDragIcon(); } catch { /* fall back to no icon */ }
    await startDrag({ item: [path], icon });
    return true;
  } catch (e) {
    console.warn('native drag-out unavailable', e);
    return false;
  }
}

/** Save a backend-provided Blob (already-formatted file) via download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url); // always revoke, even if a DOM op throws
  }
}
