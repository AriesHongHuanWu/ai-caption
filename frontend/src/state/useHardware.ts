/* ──────────────────────────────────────────────────────────────────
   state/useHardware.ts — Zustand store for hardware detection.

   Fetches GET /api/hardware once (lazy, on first access) and caches
   the result for the session.  Offline-graceful: if the backend is
   not yet reachable, `hardware` stays null and `loading` turns false
   so callers can render a skeleton / skip the panel.

   Exposed:
     hardware   — HardwareInfo | null
     loading    — initial fetch in-flight
     offline    — backend unreachable (ApiError.offline)
     error      — last error string or null
     fetch()    — trigger/re-trigger the fetch (idempotent while in-flight)
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import { getHardware } from '../api/hardware';
import { ApiError } from '../api/client';
import type { HardwareInfo } from '../api/types';

interface HardwareState {
  hardware: HardwareInfo | null;
  loading: boolean;
  offline: boolean;
  error: string | null;
  /** True once a successful fetch has completed (prevents redundant re-fetches). */
  _fetched: boolean;

  /** Fetch hardware info. Safe to call multiple times — skips if already loaded
   *  or in-flight. Pass `force = true` to re-fetch regardless. */
  fetch: (force?: boolean) => Promise<void>;
}

export const useHardware = create<HardwareState>((set, get) => ({
  hardware: null,
  loading: false,
  offline: false,
  error: null,
  _fetched: false,

  fetch: async (force = false) => {
    const { loading, _fetched } = get();
    if (!force && (_fetched || loading)) return;

    set({ loading: true, error: null });
    try {
      const hw = await getHardware();
      set({ hardware: hw, loading: false, offline: false, error: null, _fetched: true });
    } catch (err) {
      const offline = err instanceof ApiError && err.offline;
      const message = err instanceof Error ? err.message : 'unknown error';
      set({ loading: false, offline, error: message, _fetched: false });
    }
  },
}));
