/* ──────────────────────────────────────────────────────────────────
   state/useDataRoot.ts — configurable data location (which drive stores
   the engine venv + downloaded models + caches).

   Only meaningful inside the Tauri shell. In plain-browser mode inTauri
   stays false and the panel hides itself — the web build never had a
   notion of an on-disk data root.

   Mirrors the Rust `DataRootInfo` struct + `get_data_root` /
   `set_data_root` commands (lib.rs). Changing the root does NOT migrate
   existing data: the new location starts fresh (the first-run wizard
   re-builds the engine there, and model downloads land on the new
   drive via HF_HOME/TORCH_HOME). The caller relaunches to apply.
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

const IN_TAURI = '__TAURI_INTERNALS__' in window;

/** Mirrors the Rust `DataRootInfo` struct. */
export interface DataRootInfo {
  /** User-set custom path, or null when using the default. */
  custom: string | null;
  /** The path currently in effect (home of backend / venv / models). */
  effective: string;
  /** The default location (local app data). */
  default: string;
  /** Whether a custom path is active. */
  is_custom: boolean;
}

interface DataRootState {
  inTauri: boolean;
  info: DataRootInfo | null;
  loading: boolean;
  /** A set_data_root call is in flight. */
  saving: boolean;
  error: string | null;

  /** (Re)load the current data-root info from Rust. */
  load: () => Promise<void>;
  /**
   * Persist a new custom root (absolute path), or pass null to revert to
   * the default. Validates writability in Rust. Returns true on success.
   * Does NOT relaunch — the caller decides when to apply.
   */
  setRoot: (path: string | null) => Promise<boolean>;
}

export const useDataRoot = create<DataRootState>((set) => ({
  inTauri: IN_TAURI,
  info: null,
  loading: false,
  saving: false,
  error: null,

  load: async () => {
    if (!IN_TAURI) return;
    set({ loading: true, error: null });
    try {
      const info = await invoke<DataRootInfo>('get_data_root');
      set({ info, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  setRoot: async (path) => {
    if (!IN_TAURI) return false;
    set({ saving: true, error: null });
    try {
      await invoke('set_data_root', { path });
      const info = await invoke<DataRootInfo>('get_data_root');
      set({ info, saving: false });
      return true;
    } catch (e) {
      set({ saving: false, error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },
}));
