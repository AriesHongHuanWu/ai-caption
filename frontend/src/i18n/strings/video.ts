/* ──────────────────────────────────────────────────────────────────
   video — strings for the "Video → Subtitles" product mode.

   These cover the mode-aware Transcribe copy (title / lede / dropzone)
   plus the video preview, subtitle overlay, cue list, and the
   "runs on any laptop" reassurance. The song/lyrics copy stays in the
   transcribe / common namespaces; this file holds only the subtitle face.

   SPLITTING RULE (see common.ts): one Entry { zh, en }; the UI shows
   only the active language. Do NOT translate file extensions
   (MP4 / WebM / MOV / MKV) or units.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const video: Record<string, Entry> = {
  // ── Mode-aware Transcribe header ──
  'video.title': { zh: '影片字幕', en: 'Video → Subtitles' },
  'video.lede': {
    zh: '拖入一段影片或音訊，就地產生乾淨字幕 — 不需分離人聲、不需參考歌詞，全程在本機完成。',
    en: 'Drop a video or audio file and get clean captions in place — no vocal separation, no reference needed, all on your machine.',
  },

  // ── Dropzone (video) ──
  'video.drop.ariaLabel': { zh: '拖放或選擇影片 / 音訊', en: 'Drop or choose a video or audio file' },
  'video.drop.lead': {
    zh: '拖入影片，產生字幕。',
    en: 'Drop a video; get subtitles.',
  },
  'video.drop.sub': { zh: 'MP4 · WebM · MOV · MKV', en: 'MP4 · WebM · MOV · MKV' },
  'video.drop.reject': {
    zh: '這不是影片或音訊檔。請試試 MP4 · WebM · MOV · MKV。',
    en: 'Not a video or audio file — try MP4 · WebM · MOV · MKV.',
  },

  // ── Section eyebrow override (the song flow uses transcribe.section.*) ──
  'video.section.preview': { zh: '預覽', en: 'Preview' },

  // ── Run / progress copy reused under speech mode ──
  'video.run.start': { zh: '產生字幕', en: 'Generate subtitles' },
  'video.run.dropFirst': { zh: '先放一段影片', en: 'Drop a video first' },

  // ── Video preview ──
  'video.preview.ariaLabel': { zh: '影片預覽', en: 'Video preview' },
  'video.preview.empty': {
    zh: '選一段影片後，這裡會顯示預覽與字幕。',
    en: 'Choose a video to preview it with live captions here.',
  },

  // ── Subtitle overlay ──
  'video.overlay.ariaLabel': { zh: '字幕', en: 'Caption' },

  // ── Cue list ──
  'video.cues.title': { zh: '字幕段落', en: 'Subtitle cues' },
  'video.cues.ariaLabel': { zh: '字幕段落，點擊跳轉', en: 'Subtitle cues — click to seek' },
  'video.cues.empty': {
    zh: '完成後，每一句字幕都會列在這裡。',
    en: 'Once it finishes, every caption cue is listed here.',
  },
  'video.cues.count': { zh: '{count} 段', en: '{count} cues' },
  'video.cues.seekTitle': { zh: '跳到這一句', en: 'Seek to this cue' },

  // ── No-GPU reassurance (video empty state) ──
  'video.noGpu.title': {
    zh: '任何筆電都能跑 — 不需要獨立顯卡',
    en: 'Runs on any laptop — no GPU needed',
  },
  'video.noGpu.body': {
    zh: '我們會自動挑選適合 CPU 的快速模型；有獨立顯卡時則自動加速。一切都在本機進行，檔案不會上傳。',
    en: 'We auto-pick a fast, CPU-friendly model, and use your GPU automatically when one is present. Everything stays on this machine — nothing is uploaded.',
  },
  'video.noGpu.modelNote': {
    zh: '已選用快速模型：{model}',
    en: 'Using fast model: {model}',
  },
};
