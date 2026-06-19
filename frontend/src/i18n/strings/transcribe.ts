/* ──────────────────────────────────────────────────────────────────
   transcribe — Transcribe tab keys.

   SPLITTING RULE: old inline bilingual string → ONE Entry { zh, en }.
   The UI shows ONLY the active language.

   Do NOT translate: model ids (large-v3), 'whisper', file extensions,
   units (GB/ms), console logs, CSS class names.
   ────────────────────────────────────────────────────────────────── */

import type { Entry } from '../types';

export const transcribe: Record<string, Entry> = {
  // ── Page header ──
  'transcribe.title': { zh: '辨識', en: 'Transcribe' },
  'transcribe.lede': {
    zh: '載入一首歌，選擇讀取方式，貼上參考，然後執行 — 全在這一欄。',
    en: 'Load a song, choose how it is read, paste reference, run — all in one column.',
  },

  // ── Section eyebrows ──
  'transcribe.section.source': { zh: '來源', en: 'Source' },
  'transcribe.section.mode': { zh: '模式', en: 'Mode' },
  'transcribe.section.reference': { zh: '參考', en: 'Reference' },
  'transcribe.section.language': { zh: '語言', en: 'Language' },

  // ── Dropzone (empty state) ──
  'transcribe.drop.ariaLabel': { zh: '拖放或選擇一首歌', en: 'Drop or choose a song file' },
  'transcribe.drop.lead': {
    zh: '拖一首歌進來 — 它會變成一頁。',
    en: 'Drop a song; it becomes a page.',
  },
  'transcribe.drop.sub': { zh: 'MP3 · WAV · FLAC · M4A', en: 'MP3 · WAV · FLAC · M4A' },
  'transcribe.drop.reject': {
    zh: '這不是音訊檔。請試試 MP3 · WAV · FLAC · M4A。',
    en: 'Not an audio file — try MP3 · WAV · FLAC · M4A.',
  },

  // ── File card (loaded state) ──
  'transcribe.file.factFormat': { zh: '格式', en: 'Format' },
  'transcribe.file.factLength': { zh: '長度', en: 'Length' },
  'transcribe.file.factSize': { zh: '大小', en: 'Size' },
  'transcribe.file.factMix': { zh: '聲道', en: 'Mix' },
  'transcribe.file.replace': { zh: '換一首', en: 'Replace file' },
  'transcribe.file.remove': { zh: '移除檔案', en: 'Remove file' },

  // ── Mode cards ──
  'transcribe.mode.radiogroup': { zh: '辨識模式', en: 'Recognition mode' },
  'transcribe.mode.alignerUnavailable': {
    zh: '此機器未提供強制對齊',
    en: 'Aligner unavailable on this machine',
  },

  // Auto
  'transcribe.mode.auto.zh': { zh: '自動辨識', en: 'Auto Transcribe' },
  'transcribe.mode.auto.desc': {
    zh: '什麼都不貼 — 乾淨的逐字轉錄。',
    en: 'Nothing to paste; pure transcription.',
  },
  'transcribe.mode.auto.meterNote': {
    zh: '只需要一首歌',
    en: 'Just needs a song',
  },

  // Biasing
  'transcribe.mode.biasing.zh': { zh: '偏置辨識', en: 'Biasing Transcribe' },
  'transcribe.mode.biasing.desc': {
    zh: '貼片段歌詞 + 風格提示，引導辨識器 — 適合部分歌詞或風格參考，行為接近自動。',
    en: 'Paste fragments + style hint to guide the recognizer — best for partial lyrics or style references; behaves close to Auto.',
  },
  'transcribe.mode.biasing.meterNote': {
    zh: '加風格與片段更準',
    en: 'Style + fragments sharpen it',
  },
  // Hint shown in ReferenceEditor when user pastes many lines under Biasing
  'transcribe.mode.biasing.fullLyricsHint': {
    zh: '看起來像完整歌詞 — 切換到「強制對齊」能得到近乎完美的時間軸！',
    en: 'Looks like full lyrics — switch to Forced-Align for near-perfect timing!',
  },

  // Forced-Align
  'transcribe.mode.align.zh': { zh: '強制對齊', en: 'Forced-Align' },
  'transcribe.mode.align.desc': {
    zh: '貼完整歌詞 — 強制對齊能產出近乎完美的逐字時間軸，是有完整歌詞時的最佳選擇。',
    en: 'Paste the full lyrics — Forced-Align produces near-perfect word-level timing. The best choice whenever you have the complete lyrics.',
  },
  'transcribe.mode.align.meterNote': {
    zh: '歌詞越完整，對齊越精準',
    en: 'The fuller the lyrics, the closer to perfect',
  },

  // ── Reference editor ──
  'transcribe.ref.fullLyrics': { zh: '完整歌詞', en: 'Full lyrics' },
  'transcribe.ref.fragments': { zh: '片段歌詞', en: 'Fragments' },
  'transcribe.ref.linesChars': { zh: '行', en: 'lines' },
  'transcribe.ref.chars': { zh: '字', en: 'chars' },
  'transcribe.ref.placeholderAlign': {
    zh: '貼上完整歌詞，每行一句 — 換行會被保留。',
    en: 'Paste the full lyrics, one line per phrase — every line break is honoured.',
  },
  'transcribe.ref.placeholderBiasing': {
    zh: '貼上你記得的片段 — 不必完整。',
    en: 'Paste whatever fragments you remember — partial is fine.',
  },
  'transcribe.ref.hintAlign': {
    zh: '換行有意義 — 每行對齊一句。',
    en: 'Line breaks are meaningful; each line aligns as one phrase.',
  },
  'transcribe.ref.hintBiasing': {
    zh: '換行有意義。',
    en: 'Line breaks are meaningful.',
  },
  'transcribe.ref.ariaAlign': { zh: '完整歌詞', en: 'Full lyrics' },
  'transcribe.ref.ariaFragments': { zh: '片段歌詞', en: 'Fragment lyrics' },

  // ── Style chips ──
  'transcribe.style.label': { zh: '風格', en: 'Style' },
  // Per-genre labels, keyed by StyleOption.key (meta.styles). Looked up via
  // transcribe.style.<key>; unknown server keys fall back to the raw label.
  'transcribe.style.pop': { zh: '流行', en: 'Pop' },
  'transcribe.style.ballad': { zh: '抒情', en: 'Ballad' },
  'transcribe.style.rock': { zh: '搖滾', en: 'Rock' },
  'transcribe.style.rap': { zh: '饒舌', en: 'Rap / Hip-hop' },
  'transcribe.style.electronic': { zh: '電子', en: 'Electronic' },
  'transcribe.style.folk': { zh: '民謠', en: 'Folk' },
  'transcribe.style.rnb': { zh: 'R&B / 靈魂樂', en: 'R&B / Soul' },
  'transcribe.style.jazz': { zh: '爵士', en: 'Jazz' },
  'transcribe.style.classical': { zh: '古典', en: 'Classical' },
  'transcribe.style.kids': { zh: '兒歌', en: 'Kids' },
  'transcribe.style.contentHintLabel': { zh: '內容提示', en: 'Content hint' },
  'transcribe.style.contentHintPlaceholder': {
    zh: '例如：歌名、歌手、專有名詞、副歌關鍵字…',
    en: 'e.g. title, artist, proper nouns, hook keywords…',
  },
  'transcribe.style.contentHintHint': {
    zh: '自由文字 — 餵給辨識器當偏置線索。',
    en: 'Freeform — biases the recognizer toward these words.',
  },

  // ── Language select ──
  'transcribe.lang.label': { zh: '語言', en: 'Language' },
  'transcribe.lang.hint': {
    zh: 'Auto 會自動偵測 — 或鎖定一種語言。',
    en: 'Auto-detect, or lock a language.',
  },
  'transcribe.lang.autoDetect': { zh: '自動偵測', en: 'Auto-detect' },
  'transcribe.lang.multi': { zh: '多語混合', en: 'Multi-language' },

  // ── Engine knobs ──
  'transcribe.knobs.modelLabel': { zh: '模型', en: 'Model' },
  'transcribe.knobs.modelHintDefault': {
    zh: '越大越準，但越慢',
    en: 'Larger = more accurate, slower',
  },
  'transcribe.knobs.modelHintInstalled': { zh: '✓ 已安裝', en: '✓ Installed' },
  'transcribe.knobs.modelHintDownload': {
    zh: '首次使用會自動下載 (~{size} GB)',
    en: 'Auto-downloaded on first use (~{size} GB)',
  },
  'transcribe.knobs.deviceLabel': { zh: '裝置', en: 'Device' },
  'transcribe.knobs.deviceHintGpu': { zh: 'GPU 最快', en: 'GPU is fastest' },
  'transcribe.knobs.deviceHintNoGpu': {
    zh: '此機器未偵測到 GPU',
    en: 'No GPU detected on this machine',
  },
  'transcribe.knobs.deviceAuto': { zh: '自動', en: 'Auto' },
  'transcribe.knobs.deviceGpu': { zh: 'GPU', en: 'GPU' },
  'transcribe.knobs.deviceCpu': { zh: 'CPU', en: 'CPU' },

  // ── Vocal separation pill ──
  'transcribe.separate.label': { zh: '分離人聲 (Demucs)', en: 'Separate vocals (Demucs)' },
  'transcribe.separate.titleEnabled': {
    zh: '先用 Demucs 分離人聲，常讓辨識更乾淨。',
    en: 'Separate vocals first with Demucs — often cleaner.',
  },
  'transcribe.separate.titleDisabled': {
    zh: '此機器未提供 Demucs',
    en: 'Demucs unavailable on this machine',
  },

  // ── Precision mode (advanced decoding toggle) ──
  'transcribe.precision.label': { zh: '精準模式', en: 'Precision mode' },
  'transcribe.precision.title': {
    zh: '更精準：逐段詞級偏置（用參考歌詞）+ 抑制唱歌幻覺 + 較寬 beam + 更乾淨人聲分離 + 收緊逐字時間。較慢，但辨識更準、字幕更卡拍。',
    en: 'More accurate: per-window hotword biasing + anti-hallucination + wider beam + cleaner vocal separation + tightened word timing. Slower, but better words and tighter caption sync.',
  },

  // ── Alignment precision controls ──
  'transcribe.precision.onsetSnapLabel': { zh: '吸附聲音起點', en: 'Snap to vocal onsets' },
  'transcribe.precision.onsetSnapTitle': {
    zh: '把每個詞的開頭吸附到最近的人聲起點 — 對快節奏說唱和快速發音特別有效。',
    en: 'Snaps each word boundary to the nearest detected vocal onset — especially effective for fast rap and rapid articulation.',
  },
  'transcribe.precision.demucsModelLabel': { zh: '分離品質', en: 'Separation quality' },
  'transcribe.precision.demucsModelStandard': { zh: '標準 (htdemucs)', en: 'Standard (htdemucs)' },
  'transcribe.precision.demucsModelFt': { zh: '高品質 · 較慢 (htdemucs_ft)', en: 'High-quality · slower (htdemucs_ft)' },
  'transcribe.precision.demucsModelHint': {
    zh: '高品質模式針對人聲做了微調，精準度更好但速度較慢；首次選用會額外下載約 1.5 GB 權重。',
    en: 'High-quality is fine-tuned on vocals — more precise but slower; first use downloads ~1.5 GB of extra weights.',
  },

  // ── Forced-align helper line (shown inside the reference editor in align mode) ──
  'transcribe.ref.alignHelperLine': {
    zh: '貼上完整歌詞以獲得近乎完美的逐字時間軸（英文、中文、粵語均支援）。',
    en: 'Paste the exact full lyrics for near-perfect word-by-word timing — English, Mandarin, and Cantonese supported.',
  },

  // ── Run row ──
  'transcribe.run.running': { zh: '執行中…', en: 'Running…' },
  'transcribe.run.start': { zh: '開始辨識', en: 'Run' },
  'transcribe.run.reset': { zh: '重設', en: 'Reset' },
  'transcribe.run.resetTitle': { zh: '清除這次的進度', en: 'Clear this run' },
  'transcribe.run.dropFirst': { zh: '先放一首歌', en: 'Drop a song first' },

  // ── Stage progress ──
  'transcribe.stage.aria': { zh: '處理階段', en: 'Pipeline stages' },
  'transcribe.stage.queued': { zh: '排隊中', en: 'Queued' },
  'transcribe.stage.separate': { zh: '分離人聲', en: 'Separate' },
  'transcribe.stage.recognize': { zh: '辨識 / 對齊', en: 'Recognize / Align' },
  'transcribe.stage.done': { zh: '完成', en: 'Done' },
  'transcribe.stage.preparing': { zh: '準備中…', en: 'Preparing…' },
  'transcribe.stage.errorFallback': {
    zh: '發生錯誤 — 請再試一次。',
    en: 'Something went wrong — try again.',
  },
  'transcribe.stage.openInEditor': { zh: '在編輯器開啟', en: 'Open in Editor' },

  // ── Setup banner (first-run model download) ──
  'transcribe.setup.ariaLabel': { zh: '首次設定：下載辨識模型', en: 'First-time setup: download a recognition model' },
  'transcribe.setup.title': {
    zh: '下載一個辨識模型來開始使用',
    en: 'Download a recognition model to get started',
  },
  'transcribe.setup.sub': {
    zh: '只需下載一次，之後永久可用。',
    en: 'Choose a Whisper model to download — only needed once.',
  },
  'transcribe.setup.recommended': { zh: '建議', en: 'Recommended' },
  'transcribe.setup.download': { zh: '下載', en: 'Download' },
  'transcribe.setup.blurbSmall': { zh: '最快，適合草稿 / 低配置', en: 'Fastest — good for drafts or low-spec machines' },
  'transcribe.setup.blurbMedium': { zh: '速度與準確度平衡', en: 'Balanced speed and accuracy' },
  'transcribe.setup.blurbLargeV3': {
    zh: '最高準確度，建議搭配 8 GB 顯卡',
    en: 'Best accuracy — recommended with an 8 GB GPU',
  },
  'transcribe.setup.downloading': { zh: '下載中', en: 'Downloading' },
};
