/* ──────────────────────────────────────────────────────────────────
   ABCompare — honest, loudness-matched before/after A/B.

   Two native <audio> elements (A = mastered, B = original) play in sync;
   exactly one is audible at a time via the .muted property. The B source
   swaps between the loudness-matched render and the raw original.

   NO Web Audio: createMediaElementSource reroutes the element's output
   into a (suspended) AudioContext and silences playback — the bug we are
   not repeating. Audibility is pure .muted, so output always reaches the
   system mixer like any <audio>.
   ────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3, Play, Pause } from 'lucide-react';
import { useT } from '../../../i18n';

interface Props {
  masteredUrl: string; // A
  matchedUrl: string;  // B when loudness-matched ON
  rawUrl: string;      // B when loudness-matched OFF
  hasMatched: boolean;
}

type Side = 'A' | 'B';
const SYNC_TOL = 0.04; // 40 ms — below A/B perceptual fusion; avoids re-seek stutter

function fmt(t: number): string {
  if (!Number.isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ABCompare({ masteredUrl, matchedUrl, rawUrl, hasMatched }: Props) {
  const t = useT();
  const aRef = useRef<HTMLAudioElement>(null); // mastered
  const bRef = useRef<HTMLAudioElement>(null); // original (matched or raw)

  const [side, setSide] = useState<Side>('A');
  const [matched, setMatched] = useState(hasMatched);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  const bSrc = matched && hasMatched ? matchedUrl : rawUrl;

  // Audibility: exactly one element unmuted. Re-assert after a src swap
  // (a fresh element starts unmuted).
  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (a) a.muted = side !== 'A';
    if (b) b.muted = side !== 'B';
  }, [side, bSrc]);

  // A drives the clock; nudge B only when it drifts (re-seeking every frame ticks).
  const onATime = useCallback(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a) return;
    setTime(a.currentTime);
    if (b && Math.abs(b.currentTime - a.currentTime) > SYNC_TOL) {
      b.currentTime = a.currentTime;
    }
  }, []);

  const play = useCallback(async () => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    if (Math.abs(b.currentTime - a.currentTime) > SYNC_TOL) b.currentTime = a.currentTime;
    await Promise.allSettled([a.play(), b.play()]);
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    aRef.current?.pause();
    bRef.current?.pause();
    setPlaying(false);
  }, []);

  const seek = useCallback((tt: number) => {
    const a = aRef.current;
    const b = bRef.current;
    if (a) a.currentTime = tt;
    if (b) b.currentTime = tt;
    setTime(tt);
  }, []);

  // When B's source swaps (matched ↔ raw), realign to A + restore mute + resume.
  const onBLoaded = useCallback(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    b.currentTime = a.currentTime;
    b.muted = side !== 'B';
    if (playing) void b.play();
  }, [side, playing]);

  return (
    <div
      className="al-ab"
      tabIndex={0}
      role="group"
      aria-label={t('master.ab.label')}
      onKeyDown={(e) => {
        if (e.key === ' ') { e.preventDefault(); void (playing ? pause() : play()); }
        else if (e.key === 'a' || e.key === 'A') setSide('A');
        else if (e.key === 'b' || e.key === 'B') setSide('B');
      }}
    >
      {/* eslint-disable jsx-a11y/media-has-caption */}
      <audio
        ref={aRef}
        src={masteredUrl}
        onTimeUpdate={onATime}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
        preload="auto"
      />
      <audio ref={bRef} src={bSrc} onLoadedMetadata={onBLoaded} preload="auto" />
      {/* eslint-enable jsx-a11y/media-has-caption */}

      <div className="al-ab__transport">
        <button type="button" className="al-ab__play" onClick={() => void (playing ? pause() : play())}
                aria-label={playing ? t('master.ab.pause') : t('master.ab.play')}>
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <span className="al-ab__time">{fmt(time)}</span>
        <input
          type="range" className="al-ab__seek" min={0} max={dur || 0} step={0.01} value={Math.min(time, dur || 0)}
          onChange={(e) => seek(Number(e.target.value))} aria-label={t('master.ab.seek')}
        />
        <span className="al-ab__time">{fmt(dur)}</span>
      </div>

      <div className="al-ab__row">
        <div className="al-ab__switch" role="group" aria-label={t('master.ab.label')}>
          <button type="button" className={`al-ab__btn${side === 'A' ? ' al-ab__btn--on' : ''}`}
                  aria-pressed={side === 'A'} onClick={() => setSide('A')}>
            <Disc3 size={13} /> {t('master.ab.mastered')}
          </button>
          <button type="button" className={`al-ab__btn${side === 'B' ? ' al-ab__btn--on' : ''}`}
                  aria-pressed={side === 'B'} onClick={() => setSide('B')}>
            {t('master.ab.original')}
          </button>
        </div>
        {hasMatched && (
          <label className="al-ab__lmatch">
            <input type="checkbox" checked={matched} onChange={(e) => setMatched(e.target.checked)} />
            <span>{t('master.ab.loudnessMatch')}</span>
            <span className="al-ab__lmatchstate">{matched ? t('master.ab.lmatchOn') : t('master.ab.lmatchOff')}</span>
          </label>
        )}
      </div>
      <p className="al-ab__why">{t('master.ab.why')}</p>
    </div>
  );
}
