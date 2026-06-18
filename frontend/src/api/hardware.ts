/* ──────────────────────────────────────────────────────────────────
   api/hardware.ts — typed wrapper for GET /api/hardware.

   Returns machine hardware info + a model recommendation from the
   backend.  The backend never crashes — it always returns a valid
   payload, even if some fields are null (no GPU, no psutil, etc.).
   ────────────────────────────────────────────────────────────────── */

import { client } from './client';
import type { HardwareInfo } from './types';

export function getHardware(): Promise<HardwareInfo> {
  return client.get<HardwareInfo>('/api/hardware');
}
