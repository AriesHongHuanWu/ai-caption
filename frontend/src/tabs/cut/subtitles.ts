/* ──────────────────────────────────────────────────────────────────
   Subtitle import — parse SRT / WebVTT / LRC text into timed cues that
   become text clips on the timeline. Mirrors the formats the app already
   EXPORTS (export.py / exporters.ts), so a file made here re-imports.
   ────────────────────────────────────────────────────────────────── */

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** "00:01:02,345" | "00:01:02.345" | "01:02.34" → seconds. */
function parseStamp(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const frac = m[4] ? Number(`0.${m[4]}`) : 0;
  return h * 3600 + min * 60 + sec + frac;
}

function parseSrtVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  // split into blocks on blank lines
  const blocks = text.replace(/\r/g, '').replace(/^WEBVTT.*$/m, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    // a numeric index line (SRT) may precede the timing line
    let i = 0;
    if (/^\d+$/.test(lines[0].trim()) && lines[1] && lines[1].includes('-->')) i = 1;
    const timing = lines[i];
    const tm = timing && timing.match(/(.+?)\s*-->\s*([^\s]+)/);
    if (!tm) continue;
    const start = parseStamp(tm[1]);
    const end = parseStamp(tm[2]);
    if (start == null || end == null) continue;
    const body = lines.slice(i + 1).join('\n').trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}

function parseLrc(text: string): Cue[] {
  const rows: { t: number; text: string }[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    // strip per-word <mm:ss.xx> enhanced tags, keep the words
    const line = raw.replace(/<\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?>/g, '');
    const stamps = [...line.matchAll(/\[(\d{1,2}:\d{1,2}(?:[.,]\d{1,3})?)\]/g)];
    if (!stamps.length) continue;
    const body = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) {
      const t = parseStamp(s[1]);
      if (t != null) rows.push({ t, text: body });
    }
  }
  rows.sort((a, b) => a.t - b.t);
  const cues: Cue[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].text) continue; // skip empty/metadata lines
    const end = rows[i + 1] ? rows[i + 1].t : rows[i].t + 4;
    cues.push({ start: rows[i].t, end: Math.max(rows[i].t + 0.4, end), text: rows[i].text });
  }
  return cues;
}

/** Auto-detect format from filename/content and return cues. */
export function parseSubtitles(text: string, filename = ''): Cue[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.lrc') || (!text.includes('-->') && /\[\d{1,2}:\d{1,2}/.test(text))) {
    return parseLrc(text);
  }
  return parseSrtVtt(text);
}
