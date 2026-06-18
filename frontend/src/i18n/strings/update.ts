/* ──────────────────────────────────────────────────────────────────
   update — In-app auto-update strings.

   Keys prefixed 'update.*'. All user-visible text for the update
   banner, progress states, Settings row, and error messages.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const update: Record<string, Entry> = {
  // ── Update banner / dialog heading ──
  'update.title': { zh: '發現新版本', en: 'Update available' },
  'update.titleWithVersion': {
    zh: '發現新版本 {version}',
    en: 'Update available — {version}',
  },

  // ── Release notes label ──
  'update.notes': { zh: '版本說明', en: 'Release notes' },

  // ── Action buttons ──
  'update.install': { zh: '立即更新', en: 'Update now' },
  'update.later': { zh: '稍後', en: 'Later' },
  'update.retry': { zh: '重試', en: 'Retry' },

  // ── Download / install progress ──
  'update.downloading': { zh: '下載中… {pct}%', en: 'Downloading… {pct}%' },
  'update.downloadingIndeterminate': { zh: '下載中…', en: 'Downloading…' },
  'update.installing': { zh: '安裝中，即將重新啟動…', en: 'Installing — restarting shortly…' },
  'update.restartNote': {
    zh: '下載完成後將自動重新啟動。',
    en: 'The app will restart automatically after download.',
  },

  // ── Settings section ──
  'update.settingsEyebrow': { zh: '應用程式更新', en: 'App updates' },
  'update.checkNow': { zh: '檢查更新', en: 'Check for updates' },
  'update.checking': { zh: '檢查中…', en: 'Checking…' },
  'update.upToDate': { zh: '已是最新版本', en: 'Up to date' },
  'update.currentVersion': { zh: '目前版本', en: 'Current version' },
  'update.latestVersion': { zh: '最新版本', en: 'Latest version' },

  // ── Error states ──
  'update.errorCheck': { zh: '檢查更新失敗', en: 'Update check failed' },
  'update.errorDownload': { zh: '下載失敗', en: 'Download failed' },
  'update.errorOffline': {
    zh: '無法連線至更新伺服器。請確認網路連線後再試。',
    en: 'Cannot reach update server. Check your connection and retry.',
  },

  // ── aria-live / a11y ──
  'update.progressLabel': {
    zh: '更新下載進度 {pct}%',
    en: 'Update download progress {pct}%',
  },
};
