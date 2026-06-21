/* ──────────────────────────────────────────────────────────────────
   effects — the editor's pro feature libraries + math: filter looks,
   transitions, text animations, blend modes, fonts, keyframe interp,
   and the chroma-key pixel pass. Pure functions, no React.
   ────────────────────────────────────────────────────────────────── */

import type { Filters, Keyframe, TextAnim, TransType, Clip } from './types';

export const smooth = (p: number) => { const x = Math.min(1, Math.max(0, p)); return x * x * (3 - 2 * x); };

/** CSS filter string for a clip's adjustments (+ optional extra blur/shadow). */
export function buildFilter(f: Filters, extraBlur = 0, shadow = 0): string {
  const parts: string[] = [];
  if (f.brightness !== 1) parts.push(`brightness(${f.brightness})`);
  if (f.contrast !== 1) parts.push(`contrast(${f.contrast})`);
  if (f.saturate !== 1) parts.push(`saturate(${f.saturate})`);
  if (f.hue) parts.push(`hue-rotate(${f.hue}deg)`);
  if (f.blur || extraBlur) parts.push(`blur(${(f.blur + extraBlur).toFixed(2)}px)`);
  if (f.sepia) parts.push(`sepia(${f.sepia})`);
  if (f.grayscale) parts.push(`grayscale(${f.grayscale})`);
  if (f.invert) parts.push(`invert(${f.invert})`);
  if (shadow > 0) parts.push(`drop-shadow(0 ${(shadow * 8).toFixed(1)}px ${(shadow * 12).toFixed(1)}px rgba(0,0,0,${(0.5 + shadow * 0.4).toFixed(2)}))`);
  return parts.length ? parts.join(' ') : 'none';
}

/** Preset "looks" — one click applies a curated filter set. */
export const LOOKS: { key: string; label: string; en: string; f: Partial<Filters> }[] = [
  { key: 'none', label: '原始', en: 'Original', f: { brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, grayscale: 0, invert: 0 } },
  { key: 'vivid', label: '鮮豔', en: 'Vivid', f: { saturate: 1.4, contrast: 1.12, brightness: 1.04 } },
  { key: 'film', label: '電影', en: 'Cinematic', f: { contrast: 1.15, saturate: 0.92, brightness: 0.98, sepia: 0.08 } },
  { key: 'warm', label: '暖陽', en: 'Warm', f: { saturate: 1.15, sepia: 0.25, brightness: 1.05, hue: -8 } },
  { key: 'cool', label: '冷調', en: 'Cool', f: { saturate: 1.1, hue: 12, brightness: 0.98, contrast: 1.05 } },
  { key: 'bw', label: '黑白', en: 'B&W', f: { grayscale: 1, contrast: 1.1 } },
  { key: 'noir', label: '暗黑', en: 'Noir', f: { grayscale: 1, contrast: 1.35, brightness: 0.9 } },
  { key: 'fade', label: '褪色', en: 'Faded', f: { saturate: 0.75, contrast: 0.9, brightness: 1.08, sepia: 0.12 } },
  { key: 'vhs', label: 'VHS', en: 'VHS', f: { saturate: 1.3, hue: 6, contrast: 1.1, invert: 0 } },
  { key: 'invert', label: '反相', en: 'Invert', f: { invert: 1 } },
];

export const TRANSITIONS: { key: TransType; label: string; en: string }[] = [
  { key: 'none', label: '無', en: 'None' },
  { key: 'fade', label: '淡入淡出', en: 'Fade' },
  { key: 'slideL', label: '左滑', en: 'Slide L' },
  { key: 'slideR', label: '右滑', en: 'Slide R' },
  { key: 'slideU', label: '上滑', en: 'Slide Up' },
  { key: 'slideD', label: '下滑', en: 'Slide Down' },
  { key: 'zoom', label: '縮放', en: 'Zoom' },
  { key: 'spin', label: '旋轉', en: 'Spin' },
  { key: 'blur', label: '模糊', en: 'Blur' },
  { key: 'wipe', label: '擦除', en: 'Wipe' },
];

export const TEXT_ANIMS: { key: TextAnim; label: string; en: string }[] = [
  { key: 'none', label: '無', en: 'None' },
  { key: 'fade', label: '淡入', en: 'Fade' },
  { key: 'up', label: '上升', en: 'Rise' },
  { key: 'down', label: '下降', en: 'Drop' },
  { key: 'left', label: '左入', en: 'In L' },
  { key: 'right', label: '右入', en: 'In R' },
  { key: 'pop', label: '彈出', en: 'Pop' },
  { key: 'type', label: '打字', en: 'Type' },
];

export const BLEND_MODES: { key: GlobalCompositeOperation; label: string }[] = [
  { key: 'source-over', label: 'Normal' },
  { key: 'screen', label: 'Screen' },
  { key: 'lighter', label: 'Add' },
  { key: 'multiply', label: 'Multiply' },
  { key: 'overlay', label: 'Overlay' },
  { key: 'soft-light', label: 'Soft light' },
  { key: 'hard-light', label: 'Hard light' },
  { key: 'difference', label: 'Difference' },
  { key: 'color-dodge', label: 'Dodge' },
  { key: 'darken', label: 'Darken' },
  { key: 'lighten', label: 'Lighten' },
];

export const FONTS: { key: string; label: string }[] = [
  { key: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { key: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { key: '"Courier New", monospace', label: 'Mono' },
  { key: 'Impact, "Arial Black", sans-serif', label: 'Impact' },
  { key: '"Comic Sans MS", cursive', label: 'Comic' },
  { key: '"Microsoft JhengHei", "PingFang TC", sans-serif', label: '黑體' },
  { key: '"Noto Serif TC", "Songti TC", serif', label: '宋體' },
];

/** Premium caption / title looks — curated for 質感 (texture). */
export const TEXT_PRESETS: { key: string; label: string; en: string; over: Partial<Clip> }[] = [
  { key: 'clean', label: '簡約', en: 'Clean', over: { stroke: 0, box: 0, shadow: 0.45, color: '#ffffff', grad: false, bold: true, letterSpacing: 0.5, fontSize: 52, posY: 0.84 } },
  { key: 'bar', label: '字幕條', en: 'Caption bar', over: { stroke: 0, box: 0.5, shadow: 0, color: '#ffffff', grad: false, bold: true, fontSize: 46, letterSpacing: 0.5, posY: 0.86 } },
  { key: 'outline', label: '描邊', en: 'Outline', over: { stroke: 6, strokeColor: '#000000', box: 0, shadow: 0.25, color: '#ffffff', grad: false, bold: true, fontSize: 56 } },
  { key: 'title', label: '大標', en: 'Title', over: { stroke: 0, box: 0, shadow: 0.6, color: '#ffffff', grad: false, bold: true, fontSize: 96, letterSpacing: 1, posY: 0.5 } },
  { key: 'gold', label: '金漸層', en: 'Gold', over: { stroke: 2, strokeColor: '#2a1c00', box: 0, shadow: 0.45, color: '#ffe39a', grad: true, gradColor: '#b9852f', bold: true, fontSize: 64 } },
  { key: 'glow', label: '霓虹', en: 'Glow', over: { stroke: 0, box: 0, shadow: 1, color: '#a8f0ff', grad: true, gradColor: '#7a5cff', bold: true, fontSize: 60 } },
];

/** Interpolate the animatable transform at clip-local time `t`. */
export function transformAt(clip: Clip, t: number): { x: number; y: number; scale: number; rotation: number; opacity: number } {
  const k = clip.keys;
  if (!k.length) return { x: clip.x, y: clip.y, scale: clip.scale, rotation: clip.rotation, opacity: clip.opacity };
  if (t <= k[0].t) return pick(k[0]);
  if (t >= k[k.length - 1].t) return pick(k[k.length - 1]);
  let i = 0;
  while (i < k.length - 1 && k[i + 1].t < t) i++;
  const a = k[i];
  const b = k[i + 1] ?? a;
  const span = b.t - a.t || 1;
  const p = smooth((t - a.t) / span);
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    scale: a.scale + (b.scale - a.scale) * p,
    rotation: a.rotation + (b.rotation - a.rotation) * p,
    opacity: a.opacity + (b.opacity - a.opacity) * p,
  };
}
const pick = (k: Keyframe) => ({ x: k.x, y: k.y, scale: k.scale, rotation: k.rotation, opacity: k.opacity });

export interface TransMod { alpha: number; tx: number; ty: number; sc: number; rot: number; blur: number; clipFrac: number }
const IDENT: TransMod = { alpha: 1, tx: 0, ty: 0, sc: 1, rot: 0, blur: 0, clipFrac: 1 };

/** Modifier for one transition at presence `p` (1 = fully present, 0 = gone). */
function trans(type: TransType, p: number, W: number, H: number): TransMod {
  const q = 1 - smooth(p);
  switch (type) {
    case 'fade': return { ...IDENT, alpha: smooth(p) };
    case 'slideL': return { ...IDENT, alpha: 1, tx: -q * W };
    case 'slideR': return { ...IDENT, alpha: 1, tx: q * W };
    case 'slideU': return { ...IDENT, alpha: 1, ty: -q * H };
    case 'slideD': return { ...IDENT, alpha: 1, ty: q * H };
    case 'zoom': return { ...IDENT, alpha: smooth(p), sc: 0.3 + 0.7 * smooth(p) };
    case 'spin': return { ...IDENT, alpha: smooth(p), sc: smooth(p), rot: q * 200 };
    case 'blur': return { ...IDENT, alpha: smooth(p), blur: q * 22 };
    case 'wipe': return { ...IDENT, clipFrac: smooth(p) };
    default: return IDENT;
  }
}

/** Combined transition modifier for a clip at local time, given its in/out.
   When in and out overlap (very short clip), offsets are blended by presence
   so opposing slide directions cross-fade instead of cancelling. */
export function transitionMod(clip: Clip, localT: number, W: number, H: number): TransMod {
  const inActive = clip.transIn.type !== 'none' && clip.transIn.dur > 0 && localT < clip.transIn.dur;
  const outActive = clip.transOut.type !== 'none' && clip.transOut.dur > 0 && localT > clip.duration - clip.transOut.dur;
  if (inActive && !outActive) return trans(clip.transIn.type, localT / clip.transIn.dur, W, H);
  if (outActive && !inActive) return trans(clip.transOut.type, (clip.duration - localT) / clip.transOut.dur, W, H);
  if (!inActive && !outActive) return IDENT;
  // both active → weight positional offsets by presence
  const pIn = localT / clip.transIn.dur; // 0..1 entering
  const m = trans(clip.transIn.type, pIn, W, H);
  const o = trans(clip.transOut.type, (clip.duration - localT) / clip.transOut.dur, W, H);
  return {
    alpha: m.alpha * o.alpha,
    tx: m.tx * (1 - pIn) + o.tx * pIn,
    ty: m.ty * (1 - pIn) + o.ty * pIn,
    sc: m.sc * o.sc,
    rot: m.rot + o.rot,
    blur: m.blur + o.blur,
    clipFrac: Math.min(m.clipFrac, o.clipFrac),
  };
}

export interface AnimState { alpha: number; tx: number; ty: number; sc: number; reveal: number }
function animOne(anim: TextAnim, p: number): AnimState {
  const q = 1 - smooth(p);
  switch (anim) {
    case 'fade': return { alpha: smooth(p), tx: 0, ty: 0, sc: 1, reveal: 1 };
    case 'up': return { alpha: smooth(p), tx: 0, ty: q * 50, sc: 1, reveal: 1 };
    case 'down': return { alpha: smooth(p), tx: 0, ty: -q * 50, sc: 1, reveal: 1 };
    case 'left': return { alpha: smooth(p), tx: q * 70, ty: 0, sc: 1, reveal: 1 };
    case 'right': return { alpha: smooth(p), tx: -q * 70, ty: 0, sc: 1, reveal: 1 };
    case 'pop': return { alpha: smooth(p), tx: 0, ty: 0, sc: 0.5 + 0.5 * smooth(p), reveal: 1 };
    case 'type': return { alpha: 1, tx: 0, ty: 0, sc: 1, reveal: smooth(p) };
    default: return { alpha: 1, tx: 0, ty: 0, sc: 1, reveal: 1 };
  }
}

/** Text animation state combining in (head) and out (tail). */
export function textAnim(clip: Clip, localT: number): AnimState {
  let s: AnimState = { alpha: 1, tx: 0, ty: 0, sc: 1, reveal: 1 };
  if (clip.animIn !== 'none' && localT < clip.animDur) s = animOne(clip.animIn, localT / clip.animDur);
  if (clip.animOut !== 'none' && localT > clip.duration - clip.animDur) {
    const o = animOne(clip.animOut, (clip.duration - localT) / clip.animDur);
    s = { alpha: s.alpha * o.alpha, tx: s.tx + o.tx, ty: s.ty + o.ty, sc: s.sc * o.sc, reveal: Math.min(s.reveal, o.reveal) };
  }
  return s;
}

/** Chroma-key a source onto a reused offscreen canvas; returns the canvas (alpha keyed). */
export function chromaKey(
  off: HTMLCanvasElement,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  color: string,
  threshold: number,
  smoothness: number,
): HTMLCanvasElement {
  off.width = sw; off.height = sh;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return off;
  ctx.clearRect(0, 0, sw, sh);
  ctx.drawImage(source, 0, 0, sw, sh);
  const kr = parseInt(color.slice(1, 3), 16);
  const kg = parseInt(color.slice(3, 5), 16);
  const kb = parseInt(color.slice(5, 7), 16);
  const img = ctx.getImageData(0, 0, sw, sh);
  const d = img.data;
  const thr = threshold * 441.673; // max rgb distance
  const soft = Math.max(1, smoothness * 441.673);
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.sqrt((d[i] - kr) ** 2 + (d[i + 1] - kg) ** 2 + (d[i + 2] - kb) ** 2);
    if (dist < thr) d[i + 3] = 0;
    else if (dist < thr + soft) d[i + 3] = Math.round(((dist - thr) / soft) * d[i + 3]);
  }
  ctx.putImageData(img, 0, 0);
  return off;
}
