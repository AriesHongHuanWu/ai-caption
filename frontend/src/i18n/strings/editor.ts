/* ──────────────────────────────────────────────────────────────────
   editor — Editor tab keys.

   SEEDED for the Editor tab agent. Add every user-visible string on that
   tab here as a namespaced 'editor.*' Entry { zh, en }. Follow the
   SPLITTING RULE in common.ts; the UI shows only the active language.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const editor: Record<string, Entry> = {
  'editor.title': { zh: '編輯', en: 'Editor' },

  // ── Empty state ──
  'editor.emptyTitle': { zh: '尚無已辨識的歌詞', en: 'No lyrics yet' },
  'editor.emptyBody': {
    zh: '先在「辨識」分頁跑一首歌 — 它會在這裡變成一份會自己播放的文件。',
    en: 'Run a song in Transcribe; it becomes a self-playing document here.',
  },

  // ── Top bar badges ──
  'editor.badge.separated': { zh: '人聲分離 Demucs', en: 'Vocal sep Demucs' },
  'editor.badge.edited': { zh: '已編輯', en: 'Edited' },
  'editor.badge.demo': { zh: '示範', en: 'Demo' },

  // ── Keyboard hint ──
  'editor.hint.keys': {
    zh: '空白鍵 播放 · ⌥↑↓ 微調',
    en: 'Space play · ⌥↑↓ nudge',
  },

  // ── Flat-read pill ──
  'editor.flatRead': { zh: '平讀', en: 'Flat read' },
  'editor.flatReadTitle': {
    zh: '平讀模式：關閉鄰行淡化',
    en: 'Flat read: disable neighbour dimming',
  },

  // ── Popover / Inspector container ──
  'editor.inspector.popoverLabel': { zh: '字詞校時 — {word}', en: 'Word inspector — {word}' },
  'editor.inspector.popoverLabelEmpty': { zh: '字詞校時', en: 'Word inspector' },

  // ── LyricDocument aria ──
  'editor.doc.ariaLabel': { zh: '歌詞文件', en: 'Lyric document' },
  'editor.doc.wordAriaLabel': { zh: '{word} — 編輯時間', en: '{word} — edit timing' },

  // ── WordInspector ──
  'editor.inspector.title': { zh: 'Word · 字詞', en: 'Word' },
  'editor.inspector.lowConfidence': { zh: '低信心', en: 'Low confidence' },
  'editor.inspector.wordTextAriaLabel': { zh: '字詞文字', en: 'Word text' },
  'editor.inspector.startMinus': { zh: '起點 −10ms', en: 'Start −10ms' },
  'editor.inspector.startPlus': { zh: '起點 +10ms', en: 'Start +10ms' },
  'editor.inspector.endMinus': { zh: '終點 −10ms', en: 'End −10ms' },
  'editor.inspector.endPlus': { zh: '終點 +10ms', en: 'End +10ms' },
  'editor.inspector.dragHint': {
    zh: '拖曳邊界 → 吸附人聲起點 · ⌥↑↓ nudge ±10 ms',
    en: 'Drag a handle to magnetize · ⌥↑↓ nudge ±10 ms',
  },
  'editor.inspector.confirmWord': { zh: '確認字詞', en: 'Confirm word' },

  // ── Transport ──
  'editor.transport.back5s': { zh: '後退 5 秒', en: 'Back 5s' },
  'editor.transport.pause': { zh: '暫停', en: 'Pause' },
  'editor.transport.play': { zh: '播放', en: 'Play' },
  'editor.transport.forward5s': { zh: '前進 5 秒', en: 'Forward 5s' },

  // ── WaveformStrip aria ──
  'editor.waveform.ariaLabel': { zh: '波形時間軸', en: 'Waveform seek' },
  'editor.waveform.startBoundary': { zh: '起點邊界', en: 'Start boundary' },
  'editor.waveform.endBoundary': { zh: '終點邊界', en: 'End boundary' },
};
