/* ──────────────────────────────────────────────────────────────────
   Downloader + Song-Analyzer API. probe() lists available formats for a
   URL; fetchMedia() downloads audio/video; analyzeSong() runs the deep
   key/BPM/structure/EQ/vocal-mix analysis. All hit the local backend.
   ────────────────────────────────────────────────────────────────── */

import { API_BASE, apiUrl, ApiError } from './client';

export interface VideoOption {
  height: number;
  ext: string;
  formatId: string;
  fps: number;
  filesizeBytes: number;
  supported: boolean;
  kind: string;
  reason?: string;
}

export interface ProbeResult {
  meta: { title: string; uploader: string; duration: number; thumbnail: string; extractor: string; webpageUrl: string };
  audioAvailable: boolean;
  audioOutputs: string[];
  videoOptions: VideoOption[];
}

export interface FetchedMedia {
  blob: Blob;
  filename: string;
  kind: string;   // 'audio' | 'video'
  ext: string;
  title: string;
  duration: number;
}

// ── Song analysis result (mirrors backend analyze_music.analyze_song) ──
export interface KeyResult {
  name: string; tonic: string; mode: string; confidence: number;
  camelot: string; tuningCents: number; score?: number;
  alternates: { name: string; tonic: string; mode: string; camelot: string; score: number }[];
}
export interface TempoResult {
  bpm: number; bpmRounded: number; confidence: number;
  candidates: { bpm: number; strength: number }[];
}
export interface Section {
  start_s: number; end_s: number; label: string; cluster: string; energyDb: number; confidence: number;
}
export interface EqBand { name: string; centerHz: number; db: number }
export interface SongElement { id: string; label: string; labelEn: string; detail: string; detailEn: string; kind: string }
export interface AdviceItem { text: string; textEn: string; spec: string }
export interface AdviceGroup { id: string; title: string; titleEn: string; items: AdviceItem[] }
export interface VocalMix {
  summary: { zh: string; en: string };
  context: { label: string; labelEn: string; value: string }[];
  groups: AdviceGroup[];
}
export interface SongAnalysis {
  durationS: number;
  sampleRate: number;
  key: KeyResult;
  tempo: TempoResult;
  genre: { top: string; confidence: number; ranking: { genre: string; prob: number }[] };
  sections: Section[];
  eq: { bands: EqBand[]; spectrum: { f: number; db: number }[]; tiltDbOct: number; centroidHz: number };
  loudness: { integratedLufs: number; truePeakDbtp: number; crestDb: number };
  sibilantHz: number[];
  elements: SongElement[];
  vocalMix: VocalMix | null;
}

export async function downloadStatus(signal?: AbortSignal): Promise<{ fetchAvailable: boolean; analyzeAvailable: boolean }> {
  try {
    const res = await fetch(apiUrl('/api/download/status'), { signal });
    if (!res.ok) return { fetchAvailable: false, analyzeAvailable: false };
    return (await res.json()) as { fetchAvailable: boolean; analyzeAvailable: boolean };
  } catch {
    return { fetchAvailable: false, analyzeAvailable: false };
  }
}

export async function probeUrl(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  const form = new FormData();
  form.append('url', url);
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/download/probe'), { method: 'POST', body: form, signal });
  } catch (err) {
    throw new ApiError(`Cannot reach local backend at ${API_BASE}`, 0, true);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = ((await res.json()) as { detail?: string }).detail ?? detail; } catch { /* */ }
    throw new ApiError(detail || `Probe failed (${res.status})`, res.status);
  }
  return (await res.json()) as ProbeResult;
}

export async function fetchMedia(
  opts: { url: string; kind: string; outputFormat: string; sourceFormatId?: string },
  signal?: AbortSignal,
): Promise<FetchedMedia> {
  const form = new FormData();
  form.append('url', opts.url);
  form.append('kind', opts.kind);
  form.append('outputFormat', opts.outputFormat);
  form.append('sourceFormatId', opts.sourceFormatId ?? '');
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/download/fetch'), { method: 'POST', body: form, signal });
  } catch (err) {
    throw new ApiError(`Cannot reach local backend at ${API_BASE}`, 0, true);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = ((await res.json()) as { detail?: string }).detail ?? detail; } catch { /* */ }
    throw new ApiError(detail || `Download failed (${res.status})`, res.status);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  const ext = res.headers.get('x-media-ext') ?? 'wav';
  const kind = res.headers.get('x-media-kind') ?? opts.kind;
  let title = '';
  try { title = decodeURIComponent(res.headers.get('x-media-title') ?? ''); } catch { title = ''; }
  const duration = Number(res.headers.get('x-media-duration') ?? 0) || 0;
  return {
    blob: await res.blob(),
    filename: m ? m[1] : `media.${ext}`,
    kind, ext, title: title || (m ? m[1] : 'media'), duration,
  };
}

export async function analyzeSong(file: File, signal?: AbortSignal): Promise<SongAnalysis> {
  const form = new FormData();
  form.append('audio', file, file.name);
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/analyze/song'), { method: 'POST', body: form, signal });
  } catch (err) {
    throw new ApiError(`Cannot reach local backend at ${API_BASE}`, 0, true);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = ((await res.json()) as { detail?: string }).detail ?? detail; } catch { /* */ }
    throw new ApiError(detail || `Analysis failed (${res.status})`, res.status);
  }
  const data = (await res.json()) as { analysis: SongAnalysis };
  return data.analysis;
}
