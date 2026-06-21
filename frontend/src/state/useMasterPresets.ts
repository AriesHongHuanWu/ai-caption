/* ──────────────────────────────────────────────────────────────────
   useMasterPresets — the user's saved custom mastering presets. Each
   captures a base style + a snapshot of the advanced settings (EQ tilt,
   width, compression, dynamics, ceiling). Persisted to localStorage so a
   producer can save "my vocal-master chain" and recall it on any track.
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';

export interface CustomPresetAdv {
  dynamics: number;
  eqBass: number;
  eqLowMid: number;
  eqPresence: number;
  eqAir: number;
  compScale: number;
  width: number;
  ceiling: number;
  autoStrength: number;
}

export interface CustomPreset {
  id: string;
  name: string;
  genre: string;          // base style the custom settings sit on top of
  loudness: string;
  adv: CustomPresetAdv;
  ts: number;
}

const STORAGE_KEY = 'al-master-presets';

function load(): CustomPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr as CustomPreset[];
    }
  } catch {
    /* private mode / bad JSON */
  }
  return [];
}

function persist(items: CustomPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

interface State {
  presets: CustomPreset[];
  save: (p: Omit<CustomPreset, 'id' | 'ts'>) => CustomPreset;
  remove: (id: string) => void;
}

export const useMasterPresets = create<State>((set, get) => ({
  presets: load(),
  save: (p) => {
    const entry: CustomPreset = { ...p, id: `mp-${Date.now().toString(36)}`, ts: Date.now() };
    const next = [entry, ...get().presets].slice(0, 50);
    persist(next);
    set({ presets: next });
    return entry;
  },
  remove: (id) => {
    const next = get().presets.filter((x) => x.id !== id);
    persist(next);
    set({ presets: next });
  },
}));
