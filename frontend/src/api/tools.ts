/* ──────────────────────────────────────────────────────────────────
   Audio Toolbox API — list the tools and run one. Analyze tools return
   a JSON result; process tools return the processed audio as a Blob.
   ────────────────────────────────────────────────────────────────── */

import { API_BASE, apiUrl, ApiError } from './client';

export interface ToolParamOption { value: string | number; label: string }
export interface ToolParam {
  key: string;
  label: string;
  type: 'number' | 'select' | 'bool';
  min?: number;
  max?: number;
  step?: number;
  default?: number | string | boolean;
  options?: ToolParamOption[];
}
export interface ToolDef {
  id: string;
  kind: 'analyze' | 'process';
  category: string;
  icon: string;
  label: string;
  labelEn: string;
  desc: string;
  descEn: string;
  params: ToolParam[];
}

export type ToolResult =
  | { kind: 'analyze'; result: Record<string, unknown> }
  | { kind: 'process'; blob: Blob; filename: string };

export async function listTools(signal?: AbortSignal): Promise<ToolDef[]> {
  const res = await fetch(apiUrl('/api/tools'), { signal });
  if (!res.ok) throw new ApiError(`Tools list failed (${res.status})`, res.status);
  const data = (await res.json()) as { tools: ToolDef[] };
  return data.tools ?? [];
}

export async function runTool(
  toolId: string,
  audio: File,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolResult> {
  const form = new FormData();
  form.append('audio', audio, audio.name);
  form.append('toolId', toolId);
  form.append('params', JSON.stringify(params));
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/tools/run'), { method: 'POST', body: form, signal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    throw new ApiError(`Cannot reach local backend at ${API_BASE} (${message})`, 0, true);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string };
      detail = j.detail ?? detail;
    } catch { /* non-JSON */ }
    throw new ApiError(detail || `Tool failed (${res.status})`, res.status);
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = (await res.json()) as { kind: 'analyze'; result: Record<string, unknown> };
    return { kind: 'analyze', result: data.result ?? {} };
  }
  // process: binary audio. Pull the filename from Content-Disposition.
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  const filename = m ? m[1] : `${audio.name.replace(/\.[^.]+$/, '')}_${toolId}`;
  return { kind: 'process', blob: await res.blob(), filename };
}
