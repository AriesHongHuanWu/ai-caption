/* ──────────────────────────────────────────────────────────────────
   Auto-Mastering (母帶) endpoints.

   Processes a mix into a release-ready master (EQ / compression / width /
   loudness target / true-peak limiter), all locally. Optionally matches an
   uploaded reference track.

   Contract (backend base http://127.0.0.1:8756):
     POST /api/master        multipart {audio, genre, loudness, reference?} -> { jobId }
     GET  /api/master/jobs/{id}                                             -> MasterJobStatus
     GET  /api/master/jobs/{id}/result                                      -> audio/wav
   ────────────────────────────────────────────────────────────────── */

import { apiUrl, ApiError, API_BASE } from './client';

export type MasterLoudness = 'streaming' | 'balanced' | 'social';
export type MasterJobStatusValue = 'queued' | 'running' | 'done' | 'error';

/** Mastering measurement/summary returned in the job meta. */
export interface MasterMeta {
  sampleRate: number;
  genre: string;
  loudness: string;
  referenceUsed: boolean;
  width: number;
  inputLufs: number;
  outputLufs: number;
  targetLufs: number;
  inputPeakDb: number;
  outputPeakDb: number;
  ceilingDb: number;
}

export interface MasterJobStatus {
  status: MasterJobStatusValue;
  pct: number;
  message: string;
  error: string | null;
  meta: MasterMeta | null;
}

export interface CreateMasterJobResponse {
  jobId: string;
}

/** POST /api/master — spawn the background mastering job. */
export async function createMasterJob(
  audio: File,
  genre: string,
  loudness: MasterLoudness,
  reference?: File | null,
  signal?: AbortSignal,
): Promise<CreateMasterJobResponse> {
  const form = new FormData();
  form.append('audio', audio, audio.name);
  form.append('genre', genre);
  form.append('loudness', loudness);
  if (reference) form.append('reference', reference, reference.name);

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/master'), { method: 'POST', body: form, signal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    throw new ApiError(`Cannot reach local backend at ${API_BASE} (${message})`, 0, true);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = (await res.json()) as { detail?: string; message?: string };
      detail = data.detail ?? data.message ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(detail || `Mastering failed (${res.status})`, res.status);
  }
  return (await res.json()) as CreateMasterJobResponse;
}

/** GET /api/master/jobs/{id} — poll job status. */
export async function getMasterJob(jobId: string, signal?: AbortSignal): Promise<MasterJobStatus> {
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api/master/jobs/${encodeURIComponent(jobId)}`), { method: 'GET', signal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    throw new ApiError(`Cannot reach local backend at ${API_BASE} (${message})`, 0, true);
  }
  if (!res.ok) {
    throw new ApiError(`Job status failed (${res.status})`, res.status);
  }
  return (await res.json()) as MasterJobStatus;
}

/** Absolute URL for the finished mastered wav. */
export function masterResultUrl(jobId: string): string {
  return apiUrl(`/api/master/jobs/${encodeURIComponent(jobId)}/result`);
}
