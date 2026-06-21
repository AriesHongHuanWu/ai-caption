/* ──────────────────────────────────────────────────────────────────
   AssetBin — bring material in. Drop / pick media (object-URLs), import
   subtitles (SRT/VTT/LRC), auto-caption from a clip's audio (local
   Whisper), or add a text title. Everything lands on the right track at
   the playhead. Captions arrive pre-styled for 質感.
   ────────────────────────────────────────────────────────────────── */

import { useCallback, useRef, useState } from 'react';
import { UploadCloud, Captions, Type, Plus, Film, Music2, Image as ImageIcon, Wand2, X } from 'lucide-react';
import { useEditor } from './useEditor';
import { makeClip, DEFAULTS } from './types';
import type { Asset, ClipKind, TrackKind } from './types';
import { parseSubtitles } from './subtitles';
import { autoCaption } from './captions';

interface Props { en: boolean; getTime: () => number; }

/** A clean, legible caption look applied to imported / auto subtitles. */
const CAPTION_STYLE = { box: 0.5, fontSize: 46, bold: true, letterSpacing: 0.5, shadow: 0, posY: 0.86 } as const;

function classify(file: File): ClipKind | null {
  const t = file.type;
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/')) return 'audio';
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) return 'video';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['wav', 'mp3', 'flac', 'm4a', 'ogg', 'aac'].includes(ext)) return 'audio';
  return null;
}

function probeMedia(url: string, kind: ClipKind): Promise<{ duration: number; w?: number; h?: number }> {
  return new Promise((resolve) => {
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => resolve({ duration: DEFAULTS.imageStill, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ duration: DEFAULTS.imageStill });
      img.src = url;
      return;
    }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio') as HTMLVideoElement;
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve({ duration: Number.isFinite(el.duration) ? el.duration : 0, w: el.videoWidth, h: el.videoHeight });
    el.onerror = () => resolve({ duration: 0 });
    el.src = url;
  });
}

const KIND_ICON = { video: Film, image: ImageIcon, audio: Music2 } as const;

export function AssetBin({ en, getTime }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [over, setOver] = useState(false);
  const [cap, setCap] = useState<{ on: boolean; msg: string }>({ on: false, msg: '' });
  const subInput = useRef<HTMLInputElement | null>(null);

  const addClip = useEditor((s) => s.addClip);
  const addTrack = useEditor((s) => s.addTrack);
  const select = useEditor((s) => s.select);

  const ensureTrack = useCallback((kind: TrackKind): string => {
    let t = useEditor.getState().doc.tracks.find((x) => x.kind === kind);
    if (!t) { addTrack(kind); t = useEditor.getState().doc.tracks.find((x) => x.kind === kind); }
    return t!.id;
  }, [addTrack]);

  const ingest = useCallback(async (files: FileList | File[]) => {
    const next: Asset[] = [];
    for (const file of Array.from(files)) {
      const kind = classify(file);
      if (!kind) continue;
      const url = URL.createObjectURL(file);
      const meta = await probeMedia(url, kind);
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 6)}`, name: file.name.replace(/\.[^.]+$/, ''), kind, src: url, duration: meta.duration || DEFAULTS.imageStill, w: meta.w, h: meta.h });
    }
    if (next.length) setAssets((a) => [...a, ...next]);
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((a) => { const hit = a.find((x) => x.id === id); if (hit) URL.revokeObjectURL(hit.src); return a.filter((x) => x.id !== id); });
  }, []);

  const addAsset = useCallback((a: Asset) => {
    const trackId = ensureTrack(a.kind === 'audio' ? 'audio' : 'visual');
    const start = Math.max(0, getTime());
    addClip(trackId, makeClip(a.kind, { name: a.name, src: a.src, srcDuration: a.duration, duration: a.kind === 'image' ? DEFAULTS.imageStill : a.duration, start }));
  }, [ensureTrack, getTime, addClip]);

  const importSubs = useCallback(async (file: File) => {
    const text = await file.text();
    const cues = parseSubtitles(text, file.name);
    if (!cues.length) { setCap({ on: false, msg: en ? 'No cues found in file' : '檔案中找不到字幕' }); return; }
    const trackId = ensureTrack('text');
    for (const cue of cues) addClip(trackId, makeClip('text', { text: cue.text, start: cue.start, duration: Math.max(0.3, cue.end - cue.start), name: 'sub', ...CAPTION_STYLE }));
  }, [ensureTrack, addClip, en]);

  const addText = useCallback(() => {
    const trackId = ensureTrack('text');
    const clip = makeClip('text', { text: en ? 'Your text' : '輸入文字', start: Math.max(0, getTime()), name: 'text', fontSize: 64, shadow: 0.45 });
    addClip(trackId, clip);
    select(clip.id);
  }, [ensureTrack, getTime, addClip, select, en]);

  const runCaptions = useCallback(async () => {
    const doc = useEditor.getState().doc;
    let src: string | null = null;
    for (const tr of doc.tracks) { for (const c of tr.clips) { if ((c.kind === 'audio' || c.kind === 'video') && c.src) { src = c.src; break; } } if (src) break; }
    if (!src) { setCap({ on: false, msg: en ? 'Add audio or video first' : '先加入音訊或影片' }); return; }
    setCap({ on: true, msg: en ? 'Transcribing…' : '辨識中…' });
    try {
      const resp = await fetch(src);
      if (!resp.ok) throw new Error(`fetch ${resp.status}`);
      const blob = await resp.blob();
      const file = new File([blob], 'caption-source', { type: blob.type || 'audio/wav' });
      const segments = await autoCaption(file, 'small', (pct, m) => setCap({ on: true, msg: `${m} ${pct}%` }));
      const trackId = ensureTrack('text');
      for (const s of segments) {
        if (!s.text.trim()) continue;
        const words = (s.words || []).filter((w) => w.word.trim()).map((w) => ({ t: Math.max(0, w.start - s.start), dur: Math.max(0.05, w.end - w.start), word: w.word.trim() }));
        addClip(trackId, makeClip('text', { ...CAPTION_STYLE, text: s.text.trim(), start: s.start, duration: Math.max(0.4, s.end - s.start), name: 'caption', words, karaoke: words.length > 0 }));
      }
      setCap({ on: false, msg: en ? `Added ${segments.length} captions ✓` : `已加入 ${segments.length} 句字幕 ✓` });
    } catch {
      setCap({ on: false, msg: en ? 'Auto-caption needs the backend + a Whisper model.' : '自動字幕需要後端與 Whisper 模型。' });
    }
  }, [en, ensureTrack, addClip]);

  return (
    <div className="al-cut__bin">
      <label className={`al-cut__drop${over ? ' is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) void ingest(e.dataTransfer.files); }}>
        <input type="file" multiple accept="video/*,image/*,audio/*,.mp4,.mov,.webm,.png,.jpg,.jpeg,.gif,.webp,.wav,.mp3,.flac,.m4a,.ogg" hidden
          onChange={(e) => { if (e.target.files) void ingest(e.target.files); e.target.value = ''; }} />
        <UploadCloud size={18} />
        <span className="al-cut__dropmain">{en ? 'Drop or pick media' : '拖入或選媒體'}</span>
        <span className="al-cut__drophint">{en ? 'video · image · audio' : '影片 · 圖片 · 音訊'}</span>
      </label>

      <div className="al-cut__binsub">{en ? 'Captions' : '字幕'}</div>
      <div className="al-cut__binrow">
        <button type="button" className="al-btn al-cut__binbtn al-btn--sm" onClick={() => void runCaptions()} disabled={cap.on}><Wand2 size={13} /> {en ? 'Auto caption' : '自動字幕'}</button>
        <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={() => subInput.current?.click()}><Captions size={13} /> {en ? 'Import' : '匯入'}</button>
        <input ref={subInput} type="file" accept=".srt,.vtt,.lrc,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importSubs(f); e.target.value = ''; }} />
        <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={addText}><Type size={13} /> {en ? 'Title' : '標題'}</button>
      </div>
      {cap.msg && <p className="al-cut__capmsg">{cap.msg}</p>}

      <div className="al-cut__binsub">{en ? 'Media' : '素材'}</div>
      <div className="al-cut__assets">
        {assets.length === 0 && <p className="al-cut__binhint">{en ? 'Tip: drop your mastered audio, a Visualizer video, or a subtitle file.' : '提示:把母帶音訊、Visualizer 影片或字幕檔拖進來。'}</p>}
        {assets.map((a) => {
          const Icon = KIND_ICON[a.kind as keyof typeof KIND_ICON] ?? Film;
          return (
            <div key={a.id} className="al-cut__asset">
              <button type="button" className="al-cut__assetadd" draggable
                onDragStart={(e) => { e.dataTransfer.setData('application/al-asset', JSON.stringify({ kind: a.kind, name: a.name, src: a.src, srcDuration: a.duration, duration: a.duration })); e.dataTransfer.effectAllowed = 'copy'; }}
                onClick={() => addAsset(a)} title={en ? 'Drag to timeline or click to add at playhead' : '拖到時間軸,或點擊加到播放頭'}>
                <Icon size={14} /><span className="al-cut__assetname">{a.name}</span><span className="al-cut__assetdur">{a.duration ? `${a.duration.toFixed(1)}s` : ''}</span><Plus size={13} className="al-cut__assetplus" />
              </button>
              <button type="button" className="al-cut__assetx" onClick={() => removeAsset(a.id)} title="remove"><X size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
