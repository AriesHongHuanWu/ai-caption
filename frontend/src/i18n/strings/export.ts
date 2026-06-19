/* ──────────────────────────────────────────────────────────────────
   export — Export tab keys.

   SEEDED for the Export tab agent. Add every user-visible string on that
   tab here as a namespaced 'export.*' Entry { zh, en }. Follow the
   SPLITTING RULE in common.ts; the UI shows only the active language.
   Do NOT translate format ids / file extensions (lrc, srt, ass, json).
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const exportStrings: Record<string, Entry> = {
  // ── Tab title ──
  'export.title': { zh: '匯出', en: 'Export' },

  // ── Empty state ──
  'export.emptyTitle': { zh: '尚無可匯出的結果', en: 'Nothing to export yet' },
  'export.emptyHint': {
    zh: '先辨識一首歌，再回來匯出檔案。',
    en: 'Run a transcription first, then export here.',
  },

  // ── Page header ──
  'export.lede': {
    zh: '把文件變成檔案 — 存檔前先看一眼忠實預覽。ASS 的 \\k 卡拉 OK 預覽會隨播放掃動，所見即所存。',
    en: 'Turn the document into files; the ASS preview sweeps against playback so preview is proof.',
  },

  // ── Section eyebrows ──
  'export.sectionFormat': { zh: '格式', en: 'Format' },
  'export.sectionOptions': { zh: '選項', en: 'Options' },
  'export.sectionPreview': { zh: '預覽', en: 'Preview' },

  // ── Stats line (use {lines} and {chars} interpolation) ──
  'export.statsLine': {
    zh: '{lines} 行 · {chars} 字元',
    en: '{lines} lines · {chars} chars',
  },

  // ── Scrub transport ──
  'export.play': { zh: '播放', en: 'Play' },
  'export.pause': { zh: '暫停', en: 'Pause' },
  'export.scrubAriaLabel': { zh: '掃動播放位置', en: 'Scrub playback' },
  'export.sweepBound': { zh: 'ASS \\k 掃動已綁定播放', en: 'ASS \\k sweep is bound to playback' },
  'export.sweepLabel': { zh: '掃動', en: 'sweep' },

  // ── Format links ──
  'export.fmtAriaLabel': { zh: '匯出格式', en: 'Export format' },
  'export.fmtLrcLine': { zh: '逐行', en: 'line' },
  'export.fmtLrcWord': { zh: '逐字', en: 'enhanced' },
  'export.fmtSrt': { zh: '字幕', en: 'subtitles' },
  'export.fmtWebVtt': { zh: 'WebVTT 字幕', en: 'WebVTT subtitles' },
  'export.fmtAss': { zh: '\\k 卡拉OK', en: '\\k karaoke' },
  'export.fmtJson': { zh: '原始結果', en: 'raw' },

  // ── FormatOptions labels ──
  'export.optLevel': { zh: '層級', en: 'Level' },
  'export.optLevelLineTitle': { zh: '一行一個時間標記', en: 'One stamp per line' },
  'export.levelLine': { zh: '逐行', en: 'Line' },
  'export.optLevelWordTitle': { zh: '每字一個時間標記', en: 'Per-word stamps' },
  'export.levelWord': { zh: '逐字', en: 'Word' },

  'export.optSweep': { zh: '掃動', en: 'Sweep' },
  'export.sweepGradient': { zh: '漸層', en: 'Gradient' },
  'export.sweepWipe': { zh: '抹過', en: 'Wipe' },
  'export.sweepFill': { zh: '填滿', en: 'Fill' },

  'export.optPrecision': { zh: '精度', en: 'Precision' },
  'export.precisionCsTitle': { zh: '百分之一秒 (LRC/ASS 原生)', en: 'Centisecond (native LRC/ASS)' },
  'export.precisionMsTitle': { zh: '毫秒', en: 'Millisecond' },

  'export.optEncoding': { zh: '編碼', en: 'Encoding' },
  'export.encodingBomTitle': {
    zh: '加上 BOM — 部分舊播放器需要',
    en: 'Adds a BOM for legacy players',
  },
  'export.encodingUtf8Title': { zh: '純 UTF-8', en: 'Plain UTF-8' },

  // ── LivePreview ──
  'export.previewAriaLabel': { zh: '檔案預覽', en: 'File preview' },

  // ── ExportActions ──
  'export.copyFailed': { zh: '複製失敗', en: 'Copy failed' },
  'export.savedTo': { zh: '已存到 {path}', en: 'Saved to {path}' },
  'export.downloaded': { zh: '已下載 {filename}', en: 'Downloaded {filename}' },
  'export.savedOffline': {
    zh: '後端離線 — 已用本機預覽輸出',
    en: 'Saved local preview (backend offline)',
  },
  'export.saveFailed': { zh: '存檔失敗', en: 'Save failed' },
  'export.saving': { zh: '輸出中…', en: 'Saving…' },
  'export.saveToDisk': { zh: '存到磁碟', en: 'Save to disk' },
  'export.routingTitle': { zh: '匯出路由', en: 'Export routing' },
  'export.copiedToClipboard': { zh: '已複製到剪貼簿', en: 'Copied to clipboard' },
};
