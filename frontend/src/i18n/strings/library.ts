/* ──────────────────────────────────────────────────────────────────
   library — Library tab keys.

   SEEDED for the Library tab agent. Add every user-visible string on
   that tab here as a namespaced 'library.*' Entry { zh, en }. Follow the
   SPLITTING RULE in common.ts; the UI shows only the active language.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const library: Record<string, Entry> = {
  // ── Tab header ──
  'library.title': { zh: '紀錄', en: 'Library' },
  'library.lede': {
    zh: '這台機器上的歷次辨識 — 重新開啟、重新匯出、複製設定。每筆都標明用了哪個模型與引擎。',
    en: 'Past runs on this machine; each shows which model + engine produced it.',
  },

  // ── Sort toolbar ──
  'library.sort.recent': { zh: '最新', en: 'Recent' },
  'library.sort.name': { zh: '名稱', en: 'Name' },
  'library.sort.duration': { zh: '時長', en: 'Duration' },
  'library.sortBtn.title': { zh: '排序方式', en: 'Sort order' },
  'library.sortBtn.aria': {
    zh: '排序：{label}。點按切換',
    en: 'Sort: {label}, click to change',
  },

  // ── Clear-all button ──
  'library.clearAll.title': { zh: '清除全部紀錄', en: 'Clear all runs' },
  'library.clearAll.label': { zh: '清除全部', en: 'Clear all' },
  'library.clearAll.confirm': {
    zh: '清除全部 {count} 筆本機紀錄？此動作無法復原。',
    en: 'Clear all {count} local runs? This cannot be undone.',
  },

  // ── Sample-data notice ──
  'library.sampleNote': {
    zh: '尚無本機紀錄 — 以下為示意，辨識完成後會出現在這裡。',
    en: 'No local runs yet — these are samples; finished runs appear here.',
  },

  // ── Empty-state (no search matches) ──
  'library.empty.title': { zh: '找不到符合的紀錄', en: 'No matching runs' },
  'library.empty.sub': { zh: '換個關鍵字試試。', en: 'Try a different search.' },

  // ── Column headers ──
  'library.col.title': { zh: '歌名', en: 'Title' },
  'library.col.mode': { zh: '模式', en: 'Mode' },
  'library.col.duration': { zh: '時長', en: 'Dur.' },
  'library.col.engine': { zh: '模型 · 引擎', en: 'Model · engine' },
  'library.col.date': { zh: '日期', en: 'Date' },
  'library.col.status': { zh: '狀態', en: 'Status' },

  // ── Search bar ──
  'library.search.placeholder': {
    zh: '搜尋名稱 / 模式 / 語言',
    en: 'Search name, mode, language',
  },
  'library.search.aria': { zh: '搜尋紀錄', en: 'Search runs' },
  'library.search.clearAria': { zh: '清除搜尋', en: 'Clear search' },
  'library.search.clearTitle': { zh: '清除', en: 'Clear' },

  // ── Run row: word count / sub-line ──
  'library.row.wordCount': { zh: '{count} 字', en: '{count} words' },
  'library.row.separated.title': {
    zh: '已先分離人聲',
    en: 'Vocals separated (Demucs)',
  },
  'library.row.separated.label': { zh: '分離', en: 'Sep.' },

  // ── Run row: cell titles ──
  'library.row.durTitle': { zh: '時長', en: 'Duration' },
  'library.row.engineTitle': { zh: '模型 · 引擎', en: 'Model · engine' },

  // ── Run row: status badges ──
  'library.row.statusSample': { zh: '範例', en: 'Sample' },
  'library.row.statusDone': { zh: '完成', en: 'Done' },

  // ── Run row: two-step delete confirm ──
  'library.row.confirmQ': { zh: '刪除？', en: 'Delete?' },
  'library.row.confirmYes': { zh: '確認刪除', en: 'Confirm delete' },

  // ── Run row: action button labels ──
  'library.row.openEditor': { zh: '在編輯器開啟', en: 'Open in Editor' },
  'library.row.reExport': { zh: '重新匯出', en: 'Re-export' },
  'library.row.dupSettings': { zh: '複製設定', en: 'Duplicate settings' },
  'library.row.delete': { zh: '刪除', en: 'Delete' },

  // ── Run row: accessible row label ──
  'library.row.aria': {
    zh: '{title} — {mode}，{lang}',
    en: '{title} — {mode}, {lang}',
  },

  // ── Language labels (script names — each in its own script; zh = en) ──
  'library.lang.zh': { zh: '中文國語', en: '中文國語' },
  'library.lang.yue': { zh: '粵語', en: '粵語' },
  'library.lang.en': { zh: 'English', en: 'English' },
  'library.lang.ja': { zh: '日本語', en: '日本語' },
  'library.lang.ko': { zh: '한국어', en: '한국어' },
  'library.lang.multi': { zh: '多語', en: 'Multilingual' },
  'library.lang.auto': { zh: '自動', en: 'Auto' },

  // ── Mode labels ──
  'library.mode.auto': { zh: '自動', en: 'Auto' },
  'library.mode.biasing': { zh: '偏置', en: 'Biasing' },
  'library.mode.align': { zh: '強制對齊', en: 'Forced-Align' },

  // ── Relative date strings ──
  'library.date.justNow': { zh: '剛剛', en: 'just now' },
  'library.date.minutesAgo': { zh: '{n} 分鐘前', en: '{n}m ago' },
  'library.date.hoursAgo': { zh: '{n} 小時前', en: '{n}h ago' },
  'library.date.daysAgo': { zh: '{n} 天前', en: '{n}d ago' },

  // ── Local assurance footer ──
  'library.assurance': {
    zh: '一切都在這台機器上 — 不會外傳。',
    en: 'Everything stays on this machine.',
  },
};
