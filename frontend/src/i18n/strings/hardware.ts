/* ──────────────────────────────────────────────────────────────────
   hardware — HardwarePanel + useHardware i18n keys.

   SPLITTING RULE: one Entry { zh, en } per user-visible string.
   Do NOT translate: model ids (large-v3, medium, small, base), units
   (GB / MB), GPU/CPU brand names, CUDA version strings.

   reasonCode mapping CONTRACT: the backend (pipeline/hardware.py
   REASON_CODES) defines these stable codes; the frontend maps each
   to a localized one-liner shown in the recommendation box.
     gpu_8gb   — CUDA + VRAM >= ~7000 MB   -> large-v3 (cuda)
     gpu_4gb   — CUDA + VRAM 4000–7000     -> medium   (cuda)
     gpu_2gb   — CUDA + VRAM 2000–4000     -> small    (cuda)
     gpu_low   — CUDA but VRAM < 2000      -> small    (cpu)
     cpu_only  — no CUDA, ordinary machine -> small    (cpu)
     cpu_weak  — no CUDA, very weak box    -> base     (cpu)
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const hardware: Record<string, Entry> = {
  // ── Panel heading / eyebrow ──
  'hardware.eyebrow': { zh: '你的配置', en: 'Your setup' },
  'hardware.loading': { zh: '偵測硬體中…', en: 'Detecting hardware…' },
  'hardware.offline': {
    zh: '後端離線 — 啟動後自動偵測。',
    en: 'Backend offline — detected after launch.',
  },

  // ── GPU row ──
  'hardware.gpu.label': { zh: 'GPU', en: 'GPU' },
  'hardware.gpu.none': { zh: '無獨立 GPU', en: 'No discrete GPU' },
  'hardware.gpu.dotOnline': { zh: 'GPU 已就緒', en: 'GPU online' },
  'hardware.gpu.dotCpu': { zh: '無 GPU', en: 'No GPU' },

  // ── VRAM row ──
  'hardware.vram.label': { zh: 'VRAM', en: 'VRAM' },
  'hardware.vram.value': { zh: '{total} 顯示記憶體', en: '{total} video memory' },
  'hardware.vram.na': { zh: '—', en: '—' },

  // ── CUDA row ──
  'hardware.cuda.label': { zh: 'CUDA', en: 'CUDA' },
  'hardware.cuda.available': { zh: 'CUDA {ver} 可用', en: 'CUDA {ver} available' },
  'hardware.cuda.availableNoVer': { zh: 'CUDA 可用', en: 'CUDA available' },
  'hardware.cuda.none': { zh: '不可用 (CPU 模式)', en: 'Not available (CPU mode)' },

  // ── CPU row ──
  'hardware.cpu.label': { zh: 'CPU', en: 'CPU' },
  'hardware.cpu.cores': { zh: '{name} · {count} 核', en: '{name} · {count} cores' },

  // ── RAM row ──
  'hardware.ram.label': { zh: 'RAM', en: 'RAM' },
  'hardware.ram.value': { zh: '{total} 記憶體', en: '{total} RAM' },
  'hardware.ram.na': { zh: '—', en: '—' },

  // ── Recommendation heading ──
  'hardware.rec.eyebrow': { zh: '建議', en: 'Recommendation' },
  'hardware.rec.model': { zh: '建議模型：', en: 'Recommended model:' },
  'hardware.rec.device': { zh: '運算裝置：', en: 'Device:' },
  'hardware.rec.deviceCuda': { zh: 'GPU (CUDA)', en: 'GPU (CUDA)' },
  'hardware.rec.deviceCpu': { zh: 'CPU', en: 'CPU' },

  // ── reasonCode → localized one-liner ──
  // Keys must exactly match the stable codes in pipeline/hardware.py REASON_CODES.
  'hardware.reason.gpu_8gb': {
    zh: '你的 GPU 有充足顯存 (≥ 7 GB)，可執行最高準確度的 large-v3。',
    en: 'Your GPU has enough VRAM (≥ 7 GB) to run the highest-accuracy large-v3.',
  },
  'hardware.reason.gpu_4gb': {
    zh: '你的 GPU 顯存充足 (≥ 4 GB)，medium 在速度與準確度間取得好的平衡。',
    en: 'Your GPU has good VRAM (≥ 4 GB) — medium balances speed and accuracy well.',
  },
  'hardware.reason.gpu_2gb': {
    zh: '你的 GPU 顯存尚可 (≥ 2 GB)，small 是在此 VRAM 下最快且可用的選項。',
    en: 'Your GPU has limited VRAM (≥ 2 GB) — small is the fastest viable option.',
  },
  'hardware.reason.gpu_low': {
    zh: '你的 GPU 顯存太小 (< 2 GB)，建議改用 CPU 執行 small 以避免記憶體不足。',
    en: 'GPU VRAM is too small (< 2 GB) — CPU inference with small avoids out-of-memory errors.',
  },
  'hardware.reason.cpu_only': {
    zh: '未偵測到相容的 GPU，small 是在 CPU 上速度最快且準確度夠用的選項。',
    en: 'No compatible GPU detected — small is the fastest accurate option on CPU.',
  },
  'hardware.reason.cpu_weak': {
    zh: '系統資源有限 (CPU 核心少且記憶體不足)，base 模型佔用更小。',
    en: 'Limited system resources (few cores + low RAM) — base keeps memory usage minimal.',
  },

  // ── Model picker ──
  'hardware.picker.label': { zh: '選擇模型', en: 'Choose a model' },
  'hardware.picker.fits': { zh: '適合你的硬體', en: 'Fits your hardware' },
  'hardware.picker.heavy': { zh: '需要更多 VRAM', en: 'Needs more VRAM' },
  'hardware.picker.cpuSlow': { zh: 'CPU 模式較慢', en: 'Slower on CPU' },
  'hardware.picker.rec': { zh: '建議', en: 'Recommended' },

  // ── Whisper size descriptions in the picker ──
  'hardware.size.base.desc': {
    zh: '超輕量，極省記憶體，準確度有限',
    en: 'Ultra-lightweight, very low memory, limited accuracy',
  },
  'hardware.size.small.desc': {
    zh: '最快，適合草稿 / 低配置機器',
    en: 'Fastest — drafts or low-spec machines',
  },
  'hardware.size.medium.desc': {
    zh: '速度與準確度的平衡點',
    en: 'Balanced speed and accuracy',
  },
  'hardware.size.large-v3-turbo.desc': {
    zh: '接近 large-v3 的準確度，速度更快',
    en: 'Near large-v3 accuracy, significantly faster',
  },
  'hardware.size.large-v3.desc': {
    zh: '最高準確度，建議搭配 8 GB 顯卡',
    en: 'Best accuracy — recommended with 8 GB GPU',
  },

  // ── Actions ──
  'hardware.action.download': { zh: '立即下載', en: 'Download now' },
  'hardware.action.skip': { zh: '先略過', en: 'Skip for now' },
  'hardware.action.downloading': { zh: '下載中…', en: 'Downloading' },
  'hardware.action.skipTitle': {
    zh: '稍後可在「設定 → 模型管理」下載',
    en: 'Download later in Settings → Model Manager',
  },
  // Shown in the first-run wizard (before the engine is installed): the model
  // download is deferred until after setup completes, so no action is offered
  // here — only the readout + recommendation.
  'hardware.action.deferNote': {
    zh: '安裝引擎後，即可在此下載建議的模型。',
    en: 'Once the engine is installed, you can download the recommended model here.',
  },
};
