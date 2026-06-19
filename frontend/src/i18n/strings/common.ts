/* ──────────────────────────────────────────────────────────────────
   common — shell + shared strings (app brand, nav tab labels, the
   StatusStrip, window controls, language toggle, and the generic
   buttons reused across tabs: 取消 / 下載 / 重試 …).

   SPLITTING RULE: an old inline bilingual string like "辨識 · Transcribe"
   becomes ONE Entry { zh: '辨識', en: 'Transcribe' }. The UI renders only
   the active language.

   DO NOT add here: model ids (large-v3), 'whisper', file extensions,
   units (GB / ms), API keys, console logs — those stay verbatim.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const common: Record<string, Entry> = {
  // ── App brand ──
  'common.appName': { zh: 'Local Studio', en: 'Local Studio' },
  'common.appTagline': {
    zh: '本地 AI 字幕 ・ 逐字歌詞',
    en: 'Local AI captions & word-level lyrics',
  },
  'common.localFirst': { zh: '本機', en: 'LOCAL-FIRST' },

  // ── Top-level product mode (Song lyrics / Video → Subtitles / Clean Text) ──
  'common.mode.switchAria': { zh: '產品模式', en: 'Product mode' },
  'common.mode.song': { zh: '歌曲歌詞', en: 'Lyrics' },
  'common.mode.video': { zh: '影片字幕', en: 'Subtitles' },
  'common.mode.clean': { zh: '文字移除', en: 'Clean Text' },
  'common.mode.songTitle': {
    zh: '歌曲歌詞 — 分離人聲、辨識、對齊出逐字卡拉 OK',
    en: 'Song lyrics — separate vocals, transcribe, align word-level karaoke',
  },
  'common.mode.videoTitle': {
    zh: '影片字幕 — 影片或音訊轉成乾淨字幕',
    en: 'Video → Subtitles — turn a video or audio file into clean captions',
  },
  'common.mode.cleanTitle': {
    zh: '文字移除 — 框出影片上多餘的文字，AI 逐幀填補成背景並保留原音軌',
    en: 'Clean Text — box unwanted text on a video; AI fills it in frame-by-frame and keeps the original audio',
  },
  'common.mode.master': { zh: '母帶', en: 'Mastering' },
  'common.mode.masterTitle': {
    zh: '母帶 — 依曲風或參考曲自動 EQ／壓縮／響度，輸出錄音室級母帶',
    en: 'Auto-Mastering — genre/reference EQ, compression & loudness for a release-ready master',
  },

  // ── Auto-Mastering (母帶) mode ──
  'master.title': { zh: '母帶處理', en: 'Auto-Mastering' },
  'master.lede': {
    zh: '上傳混音，選曲風或參考曲，本機 AI 自動 EQ／壓縮／立體聲寬度／響度，輸出可直接發佈的母帶。',
    en: 'Drop a mix, pick a genre or reference, and the local AI does EQ, compression, width & loudness for a release-ready master.',
  },
  'master.section.source': { zh: '來源', en: 'Source' },
  'master.section.style': { zh: '風格', en: 'Style' },
  'master.section.loudness': { zh: '響度目標', en: 'Loudness target' },
  'master.section.result': { zh: '結果', en: 'Result' },
  'master.drop': { zh: '拖放或選擇一首混音', en: 'Drop or choose a mix' },
  'master.original': { zh: '原始', en: 'Original' },
  'master.mastered': { zh: '母帶後', en: 'Mastered' },
  'master.genreLabel': { zh: '曲風預設', en: 'Genre preset' },
  'master.refLabel': { zh: '參考曲（選用）', en: 'Reference track (optional)' },
  'master.refDrop': { zh: '上傳一首「想要的聲音」', en: 'Upload a track you want to sound like' },
  'master.refHint': {
    zh: '有參考曲時，會比對它的音色（頻譜）來調整，忽略曲風預設。',
    en: 'With a reference, it matches that track’s tonal balance instead of the genre preset.',
  },
  'master.loud.streaming': { zh: '串流', en: 'Streaming' },
  'master.loud.balanced': { zh: '平衡', en: 'Balanced' },
  'master.loud.social': { zh: '社群', en: 'Social' },
  'master.loudDesc.streaming': { zh: 'Spotify/Apple/YouTube 標準', en: 'Spotify/Apple/YouTube standard' },
  'master.loudDesc.balanced': { zh: '較動態、通用', en: 'More dynamic, all-round' },
  'master.loudDesc.social': { zh: '較大聲，手機更有衝擊力', en: 'Louder, punchier on phones' },
  'master.start': { zh: '開始母帶處理', en: 'Master it' },
  'master.running': { zh: '處理中…', en: 'Mastering…' },
  'master.rerun': { zh: '重新處理', en: 'Master again' },
  'master.preparing': { zh: '準備中…', en: 'Preparing…' },
  'master.download': { zh: '下載母帶 (WAV)', en: 'Download master (WAV)' },
  'master.unavailable': {
    zh: '母帶相依未安裝 — 請到設定→修復，或重新安裝引擎。',
    en: 'Mastering deps not installed — repair in Settings or re-run setup.',
  },
  'master.stat.loudness': { zh: '響度', en: 'Loudness' },
  'master.stat.peak': { zh: '真峰', en: 'True peak' },
  'master.stat.gain': { zh: '增益', en: 'Gain' },
  'master.stat.gainSub': { zh: '響度提升', en: 'loudness lift' },
  'master.stat.source': { zh: '依據', en: 'Based on' },
  'master.stat.reference': { zh: '參考曲', en: 'Reference' },
  'master.error.job': { zh: '母帶處理失敗', en: 'Mastering failed' },
  'master.error.offline': { zh: '連不上本機後端', en: 'Cannot reach local backend' },

  // ── Section dynamics (verse/chorus) ──
  'master.section.dynamics': { zh: '區段動態（主歌／副歌）', en: 'Section dynamics' },
  'master.dyn.balance': { zh: '平衡', en: 'Balance' },
  'master.dyn.punch': { zh: '爆發力', en: 'Punch' },
  'master.dyn.punchHint': {
    zh: '把副歌（較滿的段落）推得更大、主歌壓小 → 對比更強、更有衝擊力。',
    en: 'Pushes the chorus louder and verses softer → stronger contrast, more impact.',
  },
  'master.dyn.balanceHint': {
    zh: '把各段落音量拉近 → 整首更一致、更耐聽。',
    en: 'Levels sections toward each other → more consistent, easier listen.',
  },
  'master.dyn.offHint': {
    zh: '保持原本的段落動態（不主動增減）。',
    en: 'Keeps the original section dynamics (no riding).',
  },

  // ── Advanced (manual) ──
  'master.advanced': { zh: '進階手動調整', en: 'Advanced (manual)' },
  'master.adv.eq': { zh: 'EQ 等化（疊加在預設上）', en: 'EQ (added on top of preset)' },
  'master.adv.bass': { zh: '低頻', en: 'Bass' },
  'master.adv.lowMid': { zh: '低中頻', en: 'Low-mid' },
  'master.adv.presence': { zh: '臨場', en: 'Presence' },
  'master.adv.air': { zh: '空氣感', en: 'Air' },
  'master.adv.dynamicsGroup': { zh: '動態與空間', en: 'Dynamics & space' },
  'master.adv.comp': { zh: '壓縮強度', en: 'Compression' },
  'master.adv.width': { zh: '立體聲寬度', en: 'Stereo width' },
  'master.adv.ceiling': { zh: '真峰天花板', en: 'True-peak ceiling' },
  'master.adv.reset': { zh: '重設進階', en: 'Reset advanced' },

  // ── Window controls (titlebar) ──
  'common.window.minimize': { zh: '最小化', en: 'Minimize' },
  'common.window.maximize': { zh: '最大化', en: 'Maximize' },
  'common.window.close': { zh: '關閉', en: 'Close' },

  // ── Navigation (tab rail) — the locked 5-tab IA ──
  'common.nav.aria': { zh: '主要分頁', en: 'Primary navigation' },
  'common.nav.transcribe': { zh: '辨識', en: 'Transcribe' },
  'common.nav.editor': { zh: '編輯', en: 'Editor' },
  'common.nav.export': { zh: '匯出', en: 'Export' },
  'common.nav.library': { zh: '紀錄', en: 'Library' },
  'common.nav.settings': { zh: '設定', en: 'Settings' },

  // ── StatusStrip ──
  'common.status.gpuOnline': { zh: 'GPU 已就緒', en: 'GPU online' },
  'common.status.cpuOnly': { zh: '僅 CPU', en: 'CPU only' },
  'common.status.offline': { zh: '離線預覽', en: 'OFFLINE' },
  'common.status.offlineTitle': {
    zh: '後端未連線 — UI 為離線預覽',
    en: 'Backend not reachable — UI in offline preview',
  },

  // ── Language toggle ──
  'common.lang.aria': { zh: '介面語言', en: 'Interface language' },
  'common.lang.zh': { zh: '中', en: '中' },
  'common.lang.en': { zh: 'EN', en: 'EN' },

  // ── Generic, reusable action buttons (shared by tabs) ──
  'common.action.cancel': { zh: '取消', en: 'Cancel' },
  'common.action.download': { zh: '下載', en: 'Download' },
  'common.action.retry': { zh: '重試', en: 'Retry' },
  'common.action.confirm': { zh: '確定', en: 'Confirm' },
  'common.action.close': { zh: '關閉', en: 'Close' },
  'common.action.save': { zh: '儲存', en: 'Save' },
  'common.action.delete': { zh: '刪除', en: 'Delete' },
  'common.action.remove': { zh: '移除', en: 'Remove' },
  'common.action.copy': { zh: '複製', en: 'Copy' },
  'common.action.copied': { zh: '已複製', en: 'Copied' },
  'common.action.open': { zh: '開啟', en: 'Open' },
  'common.action.back': { zh: '返回', en: 'Back' },
  'common.action.next': { zh: '下一步', en: 'Next' },
  'common.action.done': { zh: '完成', en: 'Done' },

  // ── Generic status words (shared) ──
  'common.state.loading': { zh: '載入中…', en: 'Loading…' },
  'common.state.empty': { zh: '沒有資料', en: 'Nothing here yet' },
  'common.state.error': { zh: '發生錯誤', en: 'Something went wrong' },

  // ── Misc shared fallbacks ──
  'common.untitledRun': { zh: '未命名項目', en: 'Untitled run' },

  // ── Mode names (job modes — shared across Transcribe / Library) ──
  'common.mode.auto': { zh: '自動', en: 'Auto' },
  'common.mode.full': { zh: '完整歌詞', en: 'Full lyrics' },
  'common.mode.partial': { zh: '片段歌詞', en: 'Partial lyrics' },
  'common.mode.style': { zh: '風格提示', en: 'Style hint' },
};
