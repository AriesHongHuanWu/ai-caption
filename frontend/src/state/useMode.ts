/* ──────────────────────────────────────────────────────────────────
   useMode — the top-level product mode.

   The app has two faces sharing the same 5-tab IA:
     • "song"  → Song lyrics: Demucs vocal-sep → Whisper → forced-align →
                 LRC / ASS karaoke. (the original flow, unchanged)
     • "video" → Video → Subtitles: plain speech transcription of a
                 video/audio file → clean SRT / WebVTT captions.

   The mode chiefly changes the Transcribe tab content + accepted input
   + export defaults; all five tabs stay available in both modes.

   Persisted to localStorage under 'al-appmode' so the choice survives a
   reload (matches the 'al-lang' pattern in useI18n). Default "song".
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export type AppMode = 'song' | 'video';

const STORAGE_KEY = 'al-appmode';

/** localStorage 'al-appmode' ?? 'song'. */
function initialMode(): AppMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'song' || saved === 'video') return saved;
  } catch {
    /* private mode / no storage — fall through */
  }
  return 'song';
}

interface ModeState {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  /** Flip between the two modes. */
  toggle: () => void;
}

export const useMode = create<ModeState>((set, get) => ({
  mode: initialMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
    set({ mode });
  },
  toggle: () => get().setMode(get().mode === 'song' ? 'video' : 'song'),
}));
