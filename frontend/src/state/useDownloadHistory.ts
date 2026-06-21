/* ──────────────────────────────────────────────────────────────────
   useDownloadHistory — the Downloader's history list: what was pulled,
   from where, in what format, when, and (in the desktop app) the on-disk
   path so it can be revealed / dragged again. Persisted to localStorage
   under 'al-download-history' (capped, newest first).
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export interface DownloadEntry {
  id: string;
  url: string;
  title: string;
  kind: string;        // 'audio' | 'video'
  format: string;      // ext (wav/mp3/flac/ogg/mp4/webm…)
  filename: string;
  path?: string;       // absolute disk path (Tauri only) — enables reveal/drag
  sizeBytes: number;
  ts: number;          // epoch ms
}

const STORAGE_KEY = 'al-download-history';
const MAX = 100;

function load(): DownloadEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as DownloadEntry[];
    }
  } catch {
    /* private mode / bad JSON */
  }
  return [];
}

function persist(entries: DownloadEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* ignore quota / private mode */
  }
}

interface HistoryState {
  entries: DownloadEntry[];
  add: (e: Omit<DownloadEntry, 'id' | 'ts'>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useDownloadHistory = create<HistoryState>((set, get) => ({
  entries: load(),
  add: (e) => {
    const entry: DownloadEntry = {
      ...e,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
    };
    const next = [entry, ...get().entries].slice(0, MAX);
    persist(next);
    set({ entries: next });
  },
  remove: (id) => {
    const next = get().entries.filter((x) => x.id !== id);
    persist(next);
    set({ entries: next });
  },
  clear: () => {
    persist([]);
    set({ entries: [] });
  },
}));
