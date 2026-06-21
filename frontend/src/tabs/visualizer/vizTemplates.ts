/* ──────────────────────────────────────────────────────────────────
   Visualizer templates — pure Canvas2D render functions driven by a
   real-time Web Audio AnalyserNode. Each template is `draw(ctx, frame)`;
   the host runs it every rAF for preview AND during the MediaRecorder
   export (same code path → WYSIWYG). High-quality, GPU-free, reliable.
   ────────────────────────────────────────────────────────────────── */

export interface VizParams {
  bg: string;          // background color
  accent: string;      // primary accent
  accent2: string;     // secondary accent (gradients)
  sensitivity: number; // 0.3..2 — reactivity gain
  shake: number;       // 0..1 — beat-driven camera shake
  glow: number;        // 0..1 — bloom amount
}

export interface VizFrame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  freq: Uint8Array;    // 0..255 spectrum
  time: Uint8Array;    // 0..255 waveform
  t: number;           // elapsed seconds
  level: number;       // 0..1 overall RMS-ish
  bass: number;        // 0..1 low-band energy
  beat: number;        // 0..1 decaying beat envelope (1 right after a hit)
  params: VizParams;
}

export interface VizTemplate {
  key: string;
  label: string;
  labelEn: string;
  draw: (f: VizFrame) => void;
  /** feedback templates reuse the previous frame (host skips the bg clear). */
  feedback?: boolean;
}

const TAU = Math.PI * 2;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a); const [r2, g2, b2] = hexToRgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

/** Apply a beat-driven shake transform (host wraps the draw between save/restore). */
function applyShake(f: VizFrame): void {
  const s = f.params.shake * f.beat * 18;
  if (s > 0.2) {
    const a = f.t * 53.7;
    f.ctx.translate(Math.sin(a) * s, Math.cos(a * 1.3) * s);
  }
}

// ── Template 1: mirrored spectrum bars ──────────────────────────────
const bars: VizTemplate = {
  key: 'bars', label: '頻譜柱', labelEn: 'Spectrum bars',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    applyShake(f);
    const n = 64;
    const step = Math.floor(freq.length / n);
    const bw = w / n;
    const cy = h * 0.62;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const v = (freq[i * step] / 255) * params.sensitivity;
      const bh = Math.pow(v, 1.4) * h * 0.42;
      const x = i * bw;
      const grad = ctx.createLinearGradient(0, cy - bh, 0, cy + bh);
      grad.addColorStop(0, rgba(params.accent2, 0.95));
      grad.addColorStop(0.5, rgba(params.accent, 0.95));
      grad.addColorStop(1, rgba(params.accent2, 0.95));
      ctx.fillStyle = grad;
      const pad = bw * 0.16;
      ctx.fillRect(x + pad, cy - bh, bw - pad * 2, bh * 2);            // mirrored
    }
    ctx.globalCompositeOperation = 'source-over';
    // floor reflection glow
    if (params.glow > 0) {
      ctx.fillStyle = rgba(params.accent, 0.05 + 0.12 * f.level * params.glow);
      ctx.fillRect(0, cy, w, h - cy);
    }
  },
};

// ── Template 2: radial pulse orb ────────────────────────────────────
const radial: VizTemplate = {
  key: 'radial', label: '脈動光球', labelEn: 'Radial pulse',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    applyShake(f);
    const cx = w / 2, cy = h / 2;
    const base = Math.min(w, h) * 0.16;
    const r = base * (1 + f.bass * 0.6 * params.sensitivity);
    // glow orb
    const og = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * (1.8 + f.beat));
    og.addColorStop(0, rgba(params.accent, 0.9));
    og.addColorStop(0.4, rgba(params.accent, 0.35 + 0.4 * f.beat));
    og.addColorStop(1, rgba(params.accent, 0));
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, cy, r * (1.8 + f.beat), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix(params.accent, '#ffffff', 0.5);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // radial spectrum spokes
    const n = 96;
    const step = Math.floor(freq.length / n);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1.5, w / 600);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + f.t * 0.15;
      const v = (freq[i * step] / 255) * params.sensitivity;
      const len = r * 0.6 + Math.pow(v, 1.3) * Math.min(w, h) * 0.32;
      ctx.strokeStyle = rgba(i % 2 ? params.accent2 : params.accent, 0.85);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r * 1.05), cy + Math.sin(a) * (r * 1.05));
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── Template 3: waveform ribbon ─────────────────────────────────────
const ribbon: VizTemplate = {
  key: 'ribbon', label: '波形帶', labelEn: 'Waveform ribbon',
  draw: (f) => {
    const { ctx, w, h, time, params } = f;
    applyShake(f);
    const cy = h / 2;
    const amp = h * 0.3 * (0.5 + f.level * params.sensitivity);
    ctx.globalCompositeOperation = 'lighter';
    for (let pass = 0; pass < 3; pass++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const idx = Math.floor((x / w) * time.length);
        const v = (time[idx] - 128) / 128;
        const y = cy + v * amp * (1 - pass * 0.25) + Math.sin(x * 0.01 + f.t * 2 + pass) * 6;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(pass === 0 ? params.accent : params.accent2, 0.85 - pass * 0.25);
      ctx.lineWidth = (3 - pass) * Math.max(1, w / 900);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── Template 4: particle field ──────────────────────────────────────
interface P { x: number; y: number; vx: number; vy: number; life: number; }
let particles: P[] = [];
const field: VizTemplate = {
  key: 'particles', label: '粒子場', labelEn: 'Particle field',
  draw: (f) => {
    const { ctx, w, h, params } = f;
    applyShake(f);
    // emit on beat
    const emit = Math.floor(f.beat * 8 + f.level * 3);
    for (let i = 0; i < emit && particles.length < 600; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (1 + f.bass * 6) * (1 + Math.random());
      particles.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
    ctx.globalCompositeOperation = 'lighter';
    particles = particles.filter((p) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.life -= 0.012;
      if (p.life <= 0) return false;
      const r = 2 + p.life * 4 * (1 + f.bass);
      ctx.fillStyle = rgba(p.life > 0.5 ? params.accent : params.accent2, p.life * 0.9);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── Template 5: concentric rings (beat-spawned) ─────────────────────
let rings: { r: number; life: number }[] = [];
const ringsT: VizTemplate = {
  key: 'rings', label: '同心圓環', labelEn: 'Concentric rings',
  draw: (f) => {
    const { ctx, w, h, params } = f;
    applyShake(f);
    const cx = w / 2, cy = h / 2;
    if (f.beat > 0.6) rings.push({ r: Math.min(w, h) * 0.08, life: 1 });
    ctx.globalCompositeOperation = 'lighter';
    rings = rings.filter((rg) => {
      rg.r += (4 + f.level * 10) * (1 + params.sensitivity * 0.5); rg.life -= 0.012;
      if (rg.life <= 0) return false;
      ctx.strokeStyle = rgba(params.accent, rg.life * 0.8);
      ctx.lineWidth = (2 + rg.life * 6) * Math.max(1, w / 900);
      ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, Math.PI * 2); ctx.stroke();
      return true;
    });
    // steady pulsing core
    const cr = Math.min(w, h) * 0.05 * (1 + f.bass * 1.2 * params.sensitivity);
    ctx.fillStyle = rgba(params.accent2, 0.9);
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── Template 6: beat-reactive object (shaking polygon) ──────────────
const objectT: VizTemplate = {
  key: 'object', label: '抖動物體', labelEn: 'Bouncing object',
  draw: (f) => {
    const { ctx, w, h, params } = f;
    const cx = w / 2, cy = h / 2;
    const sides = 6;
    const base = Math.min(w, h) * 0.18;
    const scale = base * (1 + (f.bass * 0.5 + f.beat * 0.35) * params.sensitivity);
    const rot = f.t * 0.5 + f.beat * 0.5;
    const jitter = f.beat * params.shake * 14;
    ctx.save();
    ctx.translate(cx + (Math.random() - 0.5) * jitter, cy + (Math.random() - 0.5) * jitter);
    ctx.rotate(rot);
    // glow
    ctx.shadowColor = params.accent; ctx.shadowBlur = 30 + 60 * f.beat * params.glow;
    const grad = ctx.createLinearGradient(-scale, -scale, scale, scale);
    grad.addColorStop(0, params.accent); grad.addColorStop(1, params.accent2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const rr = scale * (1 + 0.12 * Math.sin(a * 3 + f.t * 4) * f.level);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    // inner ring
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba('#ffffff', 0.5 + 0.5 * f.beat); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, scale * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  },
};

// ── Template 7: starfield tunnel ────────────────────────────────────
let stars: { x: number; y: number; z: number }[] = [];
const starfield: VizTemplate = {
  key: 'starfield', label: '星空隧道', labelEn: 'Starfield tunnel',
  draw: (f) => {
    const { ctx, w, h, params } = f;
    applyShake(f);
    const cx = w / 2, cy = h / 2;
    if (stars.length < 320) for (let i = 0; i < 6; i++) stars.push({ x: (Math.random() - 0.5) * w, y: (Math.random() - 0.5) * h, z: Math.random() });
    const speed = 0.004 + (f.level * 0.03 + f.beat * 0.02) * params.sensitivity;
    ctx.globalCompositeOperation = 'lighter';
    stars = stars.filter((s) => {
      s.z -= speed; if (s.z <= 0.02) return false;
      const px = cx + s.x / s.z, py = cy + s.y / s.z;
      if (px < 0 || px > w || py < 0 || py > h) return false;
      const r = (1 - s.z) * 3.2;
      ctx.fillStyle = rgba((s.z < 0.4 ? params.accent : params.accent2), (1 - s.z) * 0.9);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── Template 8: frequency terrain (scrolling) ───────────────────────
let terrainRows: number[][] = [];
const terrain: VizTemplate = {
  key: 'terrain', label: '頻率地形', labelEn: 'Frequency terrain',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    const cols = 48;
    const step = Math.floor(freq.length / cols);
    const row: number[] = [];
    for (let i = 0; i < cols; i++) row.push((freq[i * step] / 255) * params.sensitivity);
    terrainRows.unshift(row);
    if (terrainRows.length > 26) terrainRows.pop();
    ctx.globalCompositeOperation = 'lighter';
    for (let r = terrainRows.length - 1; r >= 0; r--) {
      const depth = r / 26;
      const y0 = h * 0.45 + depth * h * 0.5;
      const sc = 1 - depth * 0.55;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const x = w / 2 + (i - cols / 2) * (w / cols) * sc;
        const y = y0 - terrainRows[r][i] * h * 0.22 * sc;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rgba(mix(params.accent2, params.accent, 1 - depth), (1 - depth) * 0.7);
      ctx.lineWidth = Math.max(1, (1 - depth) * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── Template 9: spectrum bloom (radial mandala) ─────────────────────
const bloom: VizTemplate = {
  key: 'bloom', label: '光譜花', labelEn: 'Spectrum bloom',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    applyShake(f);
    const cx = w / 2, cy = h / 2;
    const petals = 48;
    const step = Math.floor(freq.length / petals);
    const baseR = Math.min(w, h) * 0.12 * (1 + f.bass * 0.4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1.5, w / 500);
    for (let mirror = 0; mirror < 2; mirror++) {
      for (let i = 0; i < petals; i++) {
        const v = (freq[i * step] / 255) * params.sensitivity;
        const a = ((mirror ? -i : i) / petals) * Math.PI * 2 + f.t * 0.2;
        const len = baseR + Math.pow(v, 1.2) * Math.min(w, h) * 0.3;
        const x = cx + Math.cos(a) * len, y = cy + Math.sin(a) * len;
        ctx.strokeStyle = rgba(i % 3 === 0 ? params.accent : params.accent2, 0.7);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * baseR, cy + Math.sin(a) * baseR);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.1) * len * 0.7, cy + Math.sin(a + 0.1) * len * 0.7, x, y);
        ctx.stroke();
      }
    }
    ctx.fillStyle = mix(params.accent, '#ffffff', 0.6);
    ctx.beginPath(); ctx.arc(cx, cy, baseR * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ── 3D templates — real rotation + perspective projection, drawn in
//    Canvas2D (no WebGL dep; composites + exports like everything else).
function proj3d(x: number, y: number, z: number, rx: number, ry: number, w: number, h: number, zoom: number): [number, number, number] {
  const cyr = Math.cos(ry), syr = Math.sin(ry);
  let X = x * cyr - z * syr; let Z = x * syr + z * cyr;
  const cxr = Math.cos(rx), sxr = Math.sin(rx);
  const Y = y * cxr - Z * sxr; Z = y * sxr + Z * cxr;
  const zc = Z + 4.2;                                   // camera distance
  const s = zoom / Math.max(0.2, zc);
  return [w / 2 + X * s, h / 2 + Y * s, s];
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V: number[][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const ICO_E: number[][] = [
  [0, 11], [0, 5], [0, 1], [0, 7], [0, 10], [1, 5], [1, 7], [1, 8], [1, 9], [2, 3],
  [2, 4], [2, 6], [2, 10], [2, 11], [3, 4], [3, 6], [3, 8], [3, 9], [4, 5], [4, 9],
  [4, 11], [5, 9], [5, 11], [6, 7], [6, 8], [6, 10], [7, 8], [7, 10], [8, 9], [10, 11],
];

const wire3d: VizTemplate = {
  key: 'wire3d', label: '3D 線框體', labelEn: '3D wireframe',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    const rx = f.t * 0.4, ry = f.t * 0.6;
    const zoom = Math.min(w, h) * 0.42 * (1 + f.bass * 0.4 * params.sensitivity);
    const pts = ICO_V.map((v, i) => {
      const d = 0.55 * (1 + (freq[(i * 7) % freq.length] / 255) * 0.5 * params.sensitivity);
      return proj3d(v[0] * d, v[1] * d, v[2] * d, rx, ry, w, h, zoom);
    });
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(params.accent, 0.85); ctx.lineWidth = Math.max(1.5, w / 700);
    ctx.shadowColor = params.accent; ctx.shadowBlur = 14 * params.glow;
    for (const [a, b] of ICO_E) { ctx.beginPath(); ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); ctx.stroke(); }
    ctx.shadowBlur = 0;
    ctx.fillStyle = mix(params.accent, '#ffffff', 0.4);
    for (const p of pts) { ctx.beginPath(); ctx.arc(p[0], p[1], 2.5 + f.bass * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  },
};

let spherePts: [number, number, number][] = [];
function ensureSphere(n: number) {
  if (spherePts.length === n) return;
  spherePts = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2; const r = Math.sqrt(Math.max(0, 1 - y * y)); const th = ga * i; spherePts.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
}
const sphere3d: VizTemplate = {
  key: 'sphere3d', label: '3D 粒子球', labelEn: '3D particle sphere',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f; ensureSphere(380);
    const rx = f.t * 0.3, ry = f.t * 0.45; const zoom = Math.min(w, h) * 0.4;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < spherePts.length; i++) {
      const [sx, sy, sz] = spherePts[i];
      const disp = 1 + (freq[(i * 3) % freq.length] / 255) * 0.8 * params.sensitivity + f.bass * 0.25;
      const [px, py, sc] = proj3d(sx * disp, sy * disp, sz * disp, rx, ry, w, h, zoom);
      ctx.fillStyle = rgba(disp > 1.4 ? params.accent : params.accent2, 0.85);
      ctx.beginPath(); ctx.arc(px, py, Math.max(0.7, 1 + sc / zoom * 3), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

const tunnel3d: VizTemplate = {
  key: 'tunnel3d', label: '3D 隧道', labelEn: '3D tunnel',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    const zoom = Math.min(w, h) * 0.5;
    const RINGS = 20, SEG = 44, SP = 1.0;
    const cam = f.t * (1.5 + f.level * 3 * params.sensitivity);
    ctx.globalCompositeOperation = 'lighter';
    for (let r = 0; r < RINGS; r++) {
      let z = (r * SP - cam) % (RINGS * SP); if (z < 0) z += RINGS * SP;
      const rad = 1.7 + (freq[(r * 5) % freq.length] / 255) * 0.5 * params.sensitivity;
      const wob = f.t * 0.3;
      ctx.beginPath();
      for (let s = 0; s <= SEG; s++) {
        const a = (s / SEG) * Math.PI * 2;
        const [px, py] = proj3d(Math.cos(a + wob) * rad, Math.sin(a + wob) * rad, z, 0, 0, w, h, zoom);
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      const fade = Math.max(0, 1 - z / (RINGS * SP));
      ctx.strokeStyle = rgba(r % 2 ? params.accent : params.accent2, fade * 0.85);
      ctx.lineWidth = Math.max(1, fade * 3.5);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

const grid3d: VizTemplate = {
  key: 'grid3d', label: '3D 地形', labelEn: '3D terrain grid',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    const zoom = Math.min(w, h) * 0.5; const rx = 0.55, ry = Math.sin(f.t * 0.2) * 0.2;
    const GX = 22, GZ = 14;
    ctx.globalCompositeOperation = 'lighter';
    for (let gz = 0; gz < GZ; gz++) {
      ctx.beginPath();
      for (let gx = 0; gx < GX; gx++) {
        const sx = (gx - GX / 2) * 0.34;
        const sz = (gz - GZ / 2) * 0.34;
        const hy = (freq[(gx * 3 + gz) % freq.length] / 255) * 0.9 * params.sensitivity;
        const [px, py] = proj3d(sx, 0.8 - hy, sz, rx, ry, w, h, zoom);
        if (gx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba(mix(params.accent2, params.accent, gz / GZ), 0.6);
      ctx.lineWidth = Math.max(1, w / 1100);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

// ════════════════════════════════════════════════════════════════════
//  Advanced "show-off" templates
// ════════════════════════════════════════════════════════════════════

// Video-feedback recursion: re-draw the previous frame zoomed + rotated
// every frame → an infinite hypnotic tunnel; a reactive emitter feeds it.
const feedbackTunnel: VizTemplate = {
  key: 'feedback', label: '回授隧道', labelEn: 'Feedback tunnel', feedback: true,
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    const cx = w / 2, cy = h / 2;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.translate(cx, cy);
    ctx.rotate(0.008 + f.level * 0.018 + f.beat * 0.02);
    const zoom = 1.028 + f.bass * 0.045 * params.sensitivity;
    ctx.scale(zoom, zoom);
    ctx.drawImage(ctx.canvas, -cx, -cy, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(params.bg, 0.05); ctx.fillRect(0, 0, w, h);   // opacity floor + tint
    // reactive emitter
    ctx.globalCompositeOperation = 'lighter';
    const n = 72, step = Math.floor(freq.length / n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + f.t;
      const v = (freq[i * step] / 255) * params.sensitivity;
      const r = Math.min(w, h) * 0.05 + Math.pow(v, 1.3) * Math.min(w, h) * 0.09;
      ctx.fillStyle = rgba(i % 2 ? params.accent : params.accent2, 0.95);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2 + v * 3, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = mix(params.accent, '#ffffff', 0.6);
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.018 * (1 + f.beat * 1.5), 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
};

// Flow field: thousands of particles advected by a curl-ish noise field,
// speed driven by the audio → fluid, organic, premium motion.
let flowP: { x: number; y: number; life: number }[] = [];
function flowAngle(x: number, y: number, t: number): number {
  return (Math.sin(x * 0.008 + t) + Math.cos(y * 0.009 - t * 0.8) + Math.sin((x + y) * 0.006 + t * 0.4)) * 1.1;
}
const flowField: VizTemplate = {
  key: 'flow', label: '流場粒子', labelEn: 'Flow field',
  draw: (f) => {
    const { ctx, w, h, params } = f;
    if (flowP.length < 1000) for (let i = 0; i < 14; i++) flowP.push({ x: Math.random() * w, y: Math.random() * h, life: 0.4 + Math.random() * 0.6 });
    const sp = 1 + f.level * 5 * params.sensitivity + f.beat * 2;
    ctx.globalCompositeOperation = 'lighter';
    flowP = flowP.filter((p) => {
      const ang = flowAngle(p.x, p.y, f.t);
      p.x += Math.cos(ang) * sp; p.y += Math.sin(ang) * sp; p.life -= 0.006;
      if (p.life <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) return false;
      ctx.fillStyle = rgba(p.life > 0.5 ? params.accent : params.accent2, p.life * 0.7);
      ctx.fillRect(p.x, p.y, 1.7, 1.7);
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
  },
};

// Liquid metaballs: orbiting additive radial blobs that merge into gooey
// liquid-metal shapes; sizes from the spectrum + bass.
const liquid: VizTemplate = {
  key: 'liquid', label: '液態金屬', labelEn: 'Liquid metal',
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    const cx = w / 2, cy = h / 2;
    applyShake(f);
    ctx.globalCompositeOperation = 'lighter';
    const N = 7;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + f.t * 0.4 * (i % 2 ? 1 : -1);
      const orbit = Math.min(w, h) * (0.1 + 0.12 * Math.sin(f.t * 0.6 + i * 1.3));
      const bv = (freq[(i * 9) % freq.length] / 255) * params.sensitivity;
      const x = cx + Math.cos(a) * orbit, y = cy + Math.sin(a) * orbit;
      const r = Math.min(w, h) * (0.05 + 0.09 * bv + 0.05 * f.bass);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(mix(params.accent, params.accent2, i / N), 0.95));
      g.addColorStop(0.55, rgba(params.accent, 0.4));
      g.addColorStop(1, rgba(params.accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },
};

// Scrolling spectrogram waterfall — pro-audio heatmap of frequency over time.
const spectro: VizTemplate = {
  key: 'spectro', label: '頻譜瀑布', labelEn: 'Spectrogram', feedback: true,
  draw: (f) => {
    const { ctx, w, h, freq, params } = f;
    ctx.drawImage(ctx.canvas, 0, 0, w, h - 2, 0, 2, w, h - 2);   // scroll down 2px
    const cols = Math.min(256, freq.length);
    const cw = w / cols;
    for (let i = 0; i < cols; i++) {
      const v = (freq[i] / 255) * params.sensitivity;
      const col = v < 0.5 ? mix(params.bg, params.accent2, v * 2) : mix(params.accent2, params.accent, (v - 0.5) * 2);
      ctx.fillStyle = rgba(col, Math.min(1, 0.2 + v * 1.4));
      ctx.fillRect(i * cw, 0, cw + 1, 2.2);
    }
  },
};

// ── Post-effects layer — applies on top of any template, baked into the
//    bitmap (so it exports). Mirror / kaleidoscope, vignette, grain, flash.
export interface VizEffects {
  mirror: 'none' | 'h' | 'quad';
  vignette: number;  // 0..1
  grain: number;     // 0..1
  flash: number;     // 0..1 beat flash
}

export function applyEffects(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  beat: number, accent: string, fx: VizEffects,
): void {
  if (fx.mirror === 'h' || fx.mirror === 'quad') {
    ctx.save(); ctx.scale(-1, 1);
    ctx.drawImage(ctx.canvas, 0, 0, w / 2, h, -w, 0, w / 2, h);   // left → right
    ctx.restore();
  }
  if (fx.mirror === 'quad') {
    ctx.save(); ctx.scale(1, -1);
    ctx.drawImage(ctx.canvas, 0, 0, w, h / 2, 0, -h, w, h / 2);   // top → bottom
    ctx.restore();
  }
  if (fx.flash > 0 && beat > 0.5) {
    ctx.fillStyle = rgba(accent, beat * fx.flash * 0.3);
    ctx.fillRect(0, 0, w, h);
  }
  if (fx.vignette > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${fx.vignette})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (fx.grain > 0) {
    const n = Math.floor(fx.grain * w * h / 3400);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.07 * fx.grain})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }
}

export const TEMPLATES: VizTemplate[] = [
  feedbackTunnel, liquid, flowField, spectro,                       // ✨ advanced
  radial, bars, ribbon, field, ringsT, objectT, starfield, terrain, bloom,
  wire3d, sphere3d, tunnel3d, grid3d,
];

export function resetTemplateState(): void {
  particles = []; rings = []; stars = []; terrainRows = []; spherePts = []; flowP = [];
}
