/* ──────────────────────────────────────────────────────────────────
   captions — auto-generate subtitles from a clip's audio using the
   app's local Whisper backend (speech mode, no separation). Returns
   timed segments the editor turns into text clips. Requires the local
   backend online and a Whisper model installed.
   ────────────────────────────────────────────────────────────────── */

import { createJob, getJob } from '../../api/jobs';
import type { JobParams, Segment } from '../../api/types';

export async function autoCaption(
  file: File,
  modelSize: JobParams['modelSize'] = 'small',
  onProgress?: (pct: number, msg: string) => void,
): Promise<Segment[]> {
  const params: JobParams = {
    mode: 'speech',
    referenceLyrics: '',
    referenceContent: '',
    styleKeys: [],
    language: null,
    modelSize,
    separate: false,
    device: 'auto',
    engine: 'whisper',
    refine: true,
    demucsModel: 'htdemucs',
  };
  const { jobId } = await createJob(file, params);
  for (;;) {
    await new Promise((r) => setTimeout(r, 800));
    const st = await getJob(jobId);
    onProgress?.(st.pct, st.stage || st.message);
    if (st.status === 'done') return st.result?.segments ?? [];
    if (st.status === 'error') throw new Error(st.error || 'transcription failed');
  }
}
