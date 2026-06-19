/* ──────────────────────────────────────────────────────────────────
   modelStatus — Settings-tab model facts + lightweight status types.

   The real install state now comes from the backend via the useModels
   store (GET /api/models → ModelInfo[]). This module no longer simulates
   downloads or seeds a fake-installed registry — it only carries:

     • MODEL_FACTS / RECOMMENDED_MODEL — curated display facts for the
       three primary whisper sizes (VRAM / speed / blurb), used by
       ModelSizePicker as a fallback when the backend does not supply a
       richer ModelInfo for a given size.
     • ModelStatus — the small {size, state, pct} shape SettingsTab maps
       backend ModelInfo into to drive the picker's "installed" mark.

   No backend probing, no localStorage, no progress machinery lives here.
   ────────────────────────────────────────────────────────────────── */

import type { ModelSize } from '../../api/types';

export type ModelState = 'absent' | 'downloading' | 'verifying' | 'installed';

export interface ModelFacts {
  /** On-disk size of the model weights. */
  diskGb: number;
  /** Peak VRAM at inference on the 8 GB target card. */
  vramGb: number;
}

export interface ModelStatus {
  size: ModelSize;
  state: ModelState;
  /** 0..100 while downloading / verifying; undefined otherwise. */
  pct: number;
}

/* Curated facts, tuned for an RTX 5060 (8 GB). Gold-standard target is
   large-v3 fitting comfortably under 8 GB with Demucs headroom.

   Only language-neutral numeric facts live here. The plain-language
   VRAM / speed / blurb hints are localised in i18n under the
   `settings.facts.*` keys and resolved in ModelSizePicker via t(). */
export const MODEL_FACTS: Record<ModelSize, ModelFacts> = {
  'large-v3': { diskGb: 3.1, vramGb: 6.2 },
  // Turbo: large-v3 quality at a fraction of the compute — the CPU-fast pick.
  'large-v3-turbo': { diskGb: 1.6, vramGb: 3.4 },
  medium: { diskGb: 1.5, vramGb: 3.1 },
  small: { diskGb: 0.5, vramGb: 1.6 },
  base: { diskGb: 0.15, vramGb: 1.0 },
  tiny: { diskGb: 0.08, vramGb: 0.7 },
};

/** Recommended default model for the 8 GB target. */
export const RECOMMENDED_MODEL: ModelSize = 'large-v3';
