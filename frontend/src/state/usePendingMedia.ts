/* ──────────────────────────────────────────────────────────────────
   usePendingMedia — a tiny one-shot hand-off slot. The Downloader stashes
   a just-downloaded File here and switches AppMode to 'song'/'video';
   TranscribeTab consumes it on mount (as if the file had been dropped),
   so the user lands in the chosen flow with the media already loaded.
   Not persisted — it's a transient hand-off, gone after one read.
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

interface PendingMedia {
  file: File;
}

interface PendingMediaState {
  pending: PendingMedia | null;
  setPending: (file: File | null) => void;
  /** Read-and-clear: returns the pending file once, then empties the slot. */
  consume: () => File | null;
}

export const usePendingMedia = create<PendingMediaState>((set, get) => ({
  pending: null,
  setPending: (file) => set({ pending: file ? { file } : null }),
  consume: () => {
    const p = get().pending;
    set({ pending: null });
    return p?.file ?? null;
  },
}));
