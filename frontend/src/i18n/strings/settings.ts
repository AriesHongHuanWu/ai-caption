/* ──────────────────────────────────────────────────────────────────
   settings — Settings tab keys.

   SEEDED for the Settings tab agent. Add every user-visible string on
   that tab here as a namespaced 'settings.*' Entry { zh, en }. Follow
   the SPLITTING RULE in common.ts; the UI shows only the active
   language. Do NOT translate model ids (large-v3), 'whisper', units
   (GB / ms), or API keys.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const settings: Record<string, Entry> = {
  // ── Tab header ──
  'settings.title': { zh: '設定', en: 'Settings' },
  'settings.lede': {
    zh: '本機控制室 — 引擎、硬體、模型管理、預設值。一切都留在這台機器上。',
    en: 'The local-first control room — engine, hardware, model manager, defaults.',
  },

  // ── Section eyebrows ──
  'settings.hardware': { zh: '硬體', en: 'Hardware' },
  'settings.engineDevice': { zh: '引擎與裝置', en: 'Engine & Device' },
  'settings.modelSize': { zh: '模型大小', en: 'Model size' },
  'settings.models': { zh: '模型管理', en: 'Models' },
  'settings.defaults': { zh: '預設值', en: 'Defaults' },
  'settings.dataLocation': { zh: '資料儲存位置', en: 'Data location' },
  'settings.privacy': { zh: '本機保證', en: 'Privacy' },

  // ── Data location (which drive stores venv + models + caches) ──
  'dataloc.lede': {
    zh: '引擎、模型與快取會放在這裡。可改放到空間較大的硬碟(例如 D:)。',
    en: 'The engine, models and caches live here. You can move them to a roomier drive (e.g. D:).',
  },
  'dataloc.desktopOnly': { zh: '此設定僅桌面版可用。', en: 'This setting is available in the desktop app.' },
  'dataloc.defaultLabel': { zh: '目前位置(預設)', en: 'Current location (default)' },
  'dataloc.customLabel': { zh: '目前位置(自訂)', en: 'Current location (custom)' },
  'dataloc.change': { zh: '變更位置…', en: 'Change location…' },
  'dataloc.reset': { zh: '還原預設', en: 'Reset to default' },
  'dataloc.pickTitle': { zh: '選擇資料儲存資料夾', en: 'Choose a folder to store app data' },
  'dataloc.confirmHead': { zh: '套用後會重新啟動', en: 'Applying will restart the app' },
  'dataloc.newLocation': { zh: '新位置', en: 'New location' },
  'dataloc.confirmBody': {
    zh: '不會搬移既有檔案 —— 新位置會重新安裝引擎,模型也會下載到此硬碟。原位置的舊資料會保留,確認沒問題後可自行刪除。',
    en: 'Existing files are not moved — the engine is set up fresh at the new location and models download to this drive. Old data stays at the previous location; you can delete it yourself once everything works.',
  },
  'dataloc.applyRestart': { zh: '套用並重新啟動', en: 'Apply & restart' },
  'dataloc.applying': { zh: '套用中…', en: 'Applying…' },
  'dataloc.cancel': { zh: '取消', en: 'Cancel' },

  // ── Section captions (field labels) ──
  'settings.captionEngine': { zh: '引擎', en: 'Engine' },
  'settings.captionDevice': { zh: '運算裝置', en: 'Device' },

  // ── Reset button ──
  'settings.resetAll': { zh: '還原', en: 'Reset' },
  'settings.resetTitle': { zh: '還原所有預設值', en: 'Reset all defaults' },

  // ── Privacy / assurance section ──
  'settings.assuranceLead': {
    zh: '一切都在這台機器上 — 不會外傳。沒有雲端、沒有遙測。',
    en: 'Everything runs locally — no cloud, no telemetry, no account.',
  },
  'settings.pathData': { zh: '資料夾', en: 'Data folder' },
  'settings.pathModels': { zh: '模型', en: 'Models' },
  'settings.pathBackend': { zh: '後端', en: 'Backend' },
  'settings.pathVersion': { zh: '版本', en: 'Version' },

  // ── GpuReadout ──
  'settings.gpu.cpuOnly': { zh: 'CPU only · 無獨立 GPU', en: 'CPU only · no discrete GPU' },
  'settings.gpu.notConnected': { zh: '未連線 · 啟動後端以讀取', en: 'Not connected · start backend to read' },
  'settings.gpu.badgeOnline': { zh: 'GPU 已就緒', en: 'GPU online' },
  'settings.gpu.badgeCpuOnly': { zh: '僅 CPU', en: 'CPU only' },
  'settings.gpu.badgeOffline': { zh: '離線', en: 'Offline' },
  'settings.gpu.vramTotal': { zh: '{total} GB 總容量 · 即時用量見工作管理員', en: '{total} GB total capacity · check Task Manager for live usage' },
  'settings.gpu.cpuMode': { zh: 'CPU 模式 · 無 VRAM。', en: 'CPU mode — no VRAM.' },
  'settings.gpu.backendOffline': { zh: '後端離線 — 啟動後讀取。', en: 'Backend offline.' },
  'settings.gpu.cudaNote': { zh: '為 8 GB 卡優化', en: 'tuned for 8 GB cards' },

  // ── EnginePicker ──
  'settings.engine.label': { zh: '引擎', en: 'Engine' },

  // ── DevicePicker ──
  'settings.device.label': { zh: '運算裝置', en: 'Device' },
  'settings.device.autoHintGpu': { zh: '優先 GPU', en: 'prefer GPU' },
  'settings.device.autoHintCpu': { zh: '退回 CPU', en: 'falls to CPU' },
  'settings.device.cudaHintAvail': { zh: 'CUDA · 最快', en: 'CUDA · fastest' },
  'settings.device.cudaHintNone': { zh: '無 GPU', en: 'no device' },
  'settings.device.cpuHint': { zh: '相容', en: 'compatible' },

  // ── ModelSizePicker ──
  'settings.msize.ariaLabel': { zh: '預設模型大小', en: 'Default model size' },
  'settings.msize.recommended': { zh: '建議', en: 'Pick' },
  'settings.msize.recommendedTitle': { zh: '為 8 GB 卡建議', en: 'Recommended for 8 GB' },
  'settings.msize.speed': { zh: '速度', en: 'Speed' },
  'settings.msize.onDisk': { zh: '磁碟佔用', en: 'on disk' },
  'settings.msize.installed': { zh: '已安裝', en: 'Installed' },
  'settings.msize.notDownloaded': { zh: '未下載', en: 'Not downloaded' },

  // ── ModelManager — kind labels ──
  'settings.kind.whisper': { zh: '辨識模型', en: 'Whisper' },
  'settings.kind.demucs': { zh: '人聲分離', en: 'Demucs' },
  'settings.kind.aligner': { zh: '強制對齊', en: 'Aligner' },

  // ── ModelManager — row strings ──
  'settings.model.recommended': { zh: '建議', en: 'Rec.' },
  'settings.model.recommendedTitle': { zh: '建議下載', en: 'Recommended' },
  'settings.model.required': { zh: '必要', en: 'Required' },
  'settings.model.requiredTitle': { zh: '必要元件', en: 'Required for this feature' },
  'settings.model.sizeDownload': { zh: '下載', en: 'download' },
  'settings.model.sizeDisk': { zh: '磁碟', en: 'disk' },
  'settings.model.downloadProgress': { zh: '下載進度 {pct}%', en: 'Download progress {pct}%' },
  'settings.model.installed': { zh: '已安裝', en: 'Installed' },
  'settings.model.download': { zh: '下載', en: 'Download' },
  'settings.model.removeLabel': { zh: '移除 {name}', en: 'Remove {name}' },
  'settings.model.confirmRequired': {
    zh: '「{name}」是必要元件。移除後對應功能將無法使用，確定繼續？',
    en: '"{name}" is required for some features. Remove anyway?',
  },

  // ── ModelManager — loading / offline ──
  'settings.model.offline': {
    zh: '後端離線 — 啟動伺服器後重整。',
    en: 'Backend offline — start the server and refresh.',
  },
  'settings.model.loading': { zh: '讀取模型清單…', en: 'Loading model list…' },

  // ── useModels store — download progress / error messages ──
  // Resolved via makeT(useI18n.getState().lang) inside the non-React store.
  'settings.model.preparing': { zh: '準備中…', en: 'Preparing…' },
  'settings.model.lostConnection': {
    zh: '與後端的連線中斷，下載狀態已遺失。',
    en: 'Lost connection to backend — download status lost.',
  },

  // ── ModelManager — footer ──
  'settings.model.diskUsed': { zh: '磁碟用量', en: 'Disk used' },
  'settings.model.refreshTitle': { zh: '重新整理模型列表', en: 'Refresh model list' },

  // ── DefaultsPanel — field labels + hints ──
  'settings.defaults.modelLabel': { zh: '預設模型', en: 'Default model' },
  'settings.defaults.modelHint': { zh: '新工作預先選好的大小', en: 'Pre-selected size for new jobs' },
  'settings.defaults.langLabel': { zh: '預設語言', en: 'Default language' },
  'settings.defaults.langHint': { zh: '留空則自動偵測', en: 'Leave blank to auto-detect' },
  'settings.defaults.langAuto': { zh: '自動偵測', en: 'Auto-detect' },
  'settings.defaults.modeLabel': { zh: '預設模式', en: 'Default mode' },
  'settings.defaults.modeHint': { zh: '辨識頁開啟時的起手式', en: 'Starting mode when Transcribe tab opens' },
  'settings.defaults.exportLabel': { zh: '預設匯出', en: 'Default export' },
  'settings.defaults.exportHint': { zh: '匯出頁的起始格式', en: 'Starting format on the Export tab' },

  // ── DefaultsPanel — mode option labels ──
  'settings.mode.auto': { zh: '純辨識', en: 'Auto · transcribe only' },
  'settings.mode.biasing': { zh: '提示', en: 'Biasing · prompt' },
  'settings.mode.align': { zh: '強制對齊', en: 'Forced-Align · align' },
  'settings.mode.alignUnavail': { zh: '(無對齊器)', en: '(no aligner)' },

  // ── DefaultsPanel — Demucs pill ──
  'settings.defaults.demucsOn': { zh: '預設分離人聲', en: 'Default to Demucs separation' },
  'settings.defaults.demucsTitle': { zh: '新工作預設先用 Demucs 分離人聲', en: 'New jobs will default to Demucs vocal separation' },
  'settings.defaults.demucsUnavailTitle': { zh: '此機未提供 Demucs separation', en: 'Demucs separation not available on this machine' },
  'settings.defaults.demucsUnavail': { zh: '此機未安裝 Demucs', en: 'Demucs unavailable' },

  // ── DefaultsPanel — legend ──
  'settings.defaults.legendSeed': { zh: '預設值會自動帶入辨識與匯出頁', en: 'Defaults are pre-filled in Transcribe and Export' },
  'settings.defaults.legendLang': { zh: '語言', en: 'Language' },
  'settings.defaults.legendMode': { zh: '模式', en: 'Mode' },
  'settings.defaults.legendLocal': { zh: '全部留在本機', en: 'Everything stays local' },

  // ── modelStatus — MODEL_FACTS blurbs / hints ──
  'settings.facts.largeVramHint': { zh: '~6.2 GB · 8 GB 卡剛好', en: '~6.2 GB · fits 8 GB' },
  'settings.facts.largeSpeedHint': { zh: '~1.0× 即時', en: '~1.0× realtime' },
  'settings.facts.largeBlurb': { zh: '最高準確度，建議 8 GB 卡使用。', en: 'Best accuracy — recommended for 8 GB.' },
  'settings.facts.mediumVramHint': { zh: '~3.1 GB · 充裕', en: '~3.1 GB · roomy' },
  'settings.facts.mediumSpeedHint': { zh: '~2.2× 即時', en: '~2.2× realtime' },
  'settings.facts.mediumBlurb': { zh: '速度與準度的平衡點。', en: 'A balanced speed / accuracy pick.' },
  'settings.facts.smallVramHint': { zh: '~1.6 GB · 極省', en: '~1.6 GB · frugal' },
  'settings.facts.smallSpeedHint': { zh: '~4.5× 即時', en: '~4.5× realtime' },
  'settings.facts.smallBlurb': { zh: '最快，適合草稿或低階卡。', en: 'Fastest — good for drafts / low VRAM.' },
};
