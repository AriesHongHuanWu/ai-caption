/* ──────────────────────────────────────────────────────────────────
   setup — first-run SetupScreen wizard keys (Tauri shell only).

   SPLITTING RULE: old inline bilingual string → ONE Entry { zh, en }.
   The UI shows ONLY the active language.

   Do NOT translate: 'Ai Caption', 'Python', 'PyTorch', version numbers,
   units (GB), URLs, file paths.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const setup: Record<string, Entry> = {
  // ── Screen chrome ──
  'setup.aria': { zh: '首次設定', en: 'First-run setup' },
  'setup.sub': {
    zh: '歡迎使用 — 首次設定',
    en: 'Welcome — first-run setup',
  },
  'setup.foot': {
    zh: 'Ai Caption · 本機優先 · 不需要網路帳號',
    en: 'Ai Caption · Local-first · No account needed',
  },

  // ── Phase 1: Python missing ──
  'setup.step1': { zh: '步驟 1', en: 'Step 1' },
  'setup.python.aria': { zh: '需要 Python', en: 'Python required' },
  'setup.python.heading': { zh: '需要 Python 3.10–3.12', en: 'Python 3.10–3.12 required' },
  'setup.python.body': {
    zh: 'Ai Caption 的辨識引擎需要系統安裝 Python 3.10、3.11 或 3.12，並已加入 PATH。',
    en: 'The recognition engine requires Python 3.10–3.12 on your system PATH.',
  },
  'setup.python.recheck': { zh: '重新檢查', en: 'Re-check' },

  // ── Phase 2: Ready to install ──
  'setup.step2': { zh: '步驟 2', en: 'Step 2' },
  'setup.install.aria': { zh: '準備安裝', en: 'Ready to install' },
  'setup.install.heading': { zh: '安裝辨識引擎', en: 'Install the engine' },
  'setup.install.body': {
    zh: 'Ai Caption 將在本機建立一個獨立的 Python 環境，並下載 PyTorch 辨識引擎（需數 GB）。安裝完成後即可開始使用，之後啟動無需再次下載。',
    en: "We'll create a local Python venv and download the PyTorch engine (a few GB). This is a one-time setup — future launches start instantly.",
  },
  'setup.install.dirLabel': { zh: '目錄', en: 'Dir' },
  'setup.install.cta': { zh: '開始設定', en: 'Set up engine' },

  // ── Phase 3: Running ──
  'setup.running.aria': { zh: '安裝中', en: 'Installing' },
  'setup.running.starting': { zh: '正在啟動安裝…', en: 'Starting…' },
  'setup.running.venv': { zh: '正在建立虛擬環境…', en: 'Creating venv…' },
  'setup.running.download': { zh: '正在下載 PyTorch…', en: 'Downloading engine…' },
  'setup.running.installing': { zh: '正在安裝套件…', en: 'Installing packages…' },
  'setup.running.note': {
    zh: '這需要幾分鐘，視網速而定。請保持網路連線。',
    en: 'This takes a few minutes depending on your connection. Keep the app open.',
  },
  'setup.running.logAria': { zh: '安裝紀錄', en: 'Setup log' },

  // ── Phase 4: Error ──
  'setup.error.aria': { zh: '安裝失敗', en: 'Setup failed' },
  'setup.error.heading': { zh: '安裝失敗', en: 'Setup failed' },
  'setup.error.retry': { zh: '重試', en: 'Retry' },

  // ── Phase 5: Success ──
  'setup.done.aria': { zh: '安裝完成', en: 'Setup complete' },
  'setup.done.heading': { zh: '安裝完成', en: 'Setup complete!' },
  'setup.done.body': {
    zh: '辨識引擎已就緒。正在啟動後端…',
    en: 'Engine ready. Launching backend…',
  },

  // ── Initial status skeleton ──
  'setup.checking': { zh: '檢查安裝狀態…', en: 'Checking status…' },
};
