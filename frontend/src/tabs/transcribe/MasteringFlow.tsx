/* ──────────────────────────────────────────────────────────────────
   MasteringFlow — Auto-Mastering (母帶) mode surface.

   Drop a mix → pick a genre + loudness target (+ optional reference
   track) → the local DSP chain (EQ / compression / width / loudness /
   true-peak limit) renders a release-ready master. A/B the original vs
   mastered, see the loudness numbers, and download a 24-bit WAV.

   Self-contained (own picker, job + poll), mirroring CleanTextFlow.
   ────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Disc3, UploadCloud, Sparkles, Download, Loader2, Music2 } from 'lucide-react';
import { Button, Eyebrow } from '../../components/primitives';
import { createMasterJob, getMasterJob, masterResultUrl } from '../../api/master';
import type { MasterLoudness, MasterMeta } from '../../api/master';
import { ApiError } from '../../api/client';
import { useMeta } from '../../state/useMeta';
import { useT } from '../../i18n';
import './mastering.css';

const POLL_MS = 700;
type Phase = 'idle' | 'running' | 'done' | 'error';

const LOUDNESS: { key: MasterLoudness; lufs: string }[] = [
  { key: 'streaming', lufs: '−14 LUFS' },
  { key: 'balanced', lufs: '−12 LUFS' },
  { key: 'social', lufs: '−9 LUFS' },
];

export function MasteringFlow() {
  const t = useT();
  const meta = useMeta((s) => s.meta);
  const genres = meta.masterGenres && meta.masterGenres.length
    ? meta.masterGenres
    : [{ key: 'auto', label: 'Auto' }];

  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  const [genre, setGenre] = useState('auto');
  const [loudness, setLoudness] = useState<MasterLoudness>('streaming');

  const [phase, setPhase] = useState<Phase>('idle');
  const [pct, setPct] = useState(0);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<MasterMeta | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (pollTimer.current) clearTimeout(pollTimer.current);
      if (srcUrl) URL.revokeObjectURL(srcUrl);
    };
  }, [srcUrl]);

  const pickFile = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setSrcUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setPhase('idle');
    setResultUrl(null);
    setResultMeta(null);
    setErrorMsg(null);
  }, []);

  const poll = useCallback(
    async (id: string) => {
      if (stoppedRef.current) return;
      try {
        const st = await getMasterJob(id);
        if (stoppedRef.current) return;
        setPct(st.pct ?? 0);
        setMessage(st.message ?? '');
        if (st.status === 'done') {
          setPct(100);
          setPhase('done');
          setResultUrl(`${masterResultUrl(id)}?t=${Date.now()}`);
          setResultMeta(st.meta);
          return;
        }
        if (st.status === 'error') {
          setErrorMsg(st.error || t('master.error.job'));
          setPhase('error');
          return;
        }
        pollTimer.current = setTimeout(() => void poll(id), POLL_MS);
      } catch (err: unknown) {
        if (stoppedRef.current) return;
        setErrorMsg(
          err instanceof ApiError && err.offline ? t('master.error.offline') : t('master.error.job'),
        );
        setPhase('error');
      }
    },
    [t],
  );

  const run = useCallback(() => {
    if (!file) return;
    stoppedRef.current = false;
    setPhase('running');
    setPct(0);
    setMessage(t('master.preparing'));
    setErrorMsg(null);
    setResultUrl(null);
    setResultMeta(null);
    void (async () => {
      try {
        const { jobId } = await createMasterJob(file, genre, loudness, reference);
        if (stoppedRef.current) return;
        pollTimer.current = setTimeout(() => void poll(jobId), POLL_MS);
      } catch (err: unknown) {
        if (stoppedRef.current) return;
        setErrorMsg(
          err instanceof ApiError && err.offline ? t('master.error.offline') : t('master.error.job'),
        );
        setPhase('error');
      }
    })();
  }, [file, genre, loudness, reference, poll, t]);

  const running = phase === 'running';
  const isDone = phase === 'done' && !!resultUrl;
  const isError = phase === 'error';

  return (
    <div className="al-tabpage">
      <div className="al-tabpage__head">
        <h1 className="al-tabpage__title">{t('master.title')}</h1>
        <p className="al-tabpage__lede">{t('master.lede')}</p>
      </div>

      {/* 01 SOURCE */}
      <section className="al-section">
        <Eyebrow num={1}>{t('master.section.source')}</Eyebrow>
        <label className="al-master__drop">
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
            className="al-master__file"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <UploadCloud size={22} />
          <span className="al-master__dropmain">
            {file ? file.name : t('master.drop')}
          </span>
          <span className="al-master__drophint">WAV · MP3 · FLAC · M4A</span>
        </label>
        {srcUrl && (
          <div className="al-master__player">
            <span className="al-master__playerlabel">{t('master.original')}</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={srcUrl} controls className="al-master__audio" />
          </div>
        )}
      </section>

      {/* 02 STYLE */}
      <section className="al-section">
        <Eyebrow num={2}>{t('master.section.style')}</Eyebrow>
        <p className="al-master__sub">{t('master.genreLabel')}</p>
        <div className="al-master__genres">
          {genres.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`al-master__chip${genre === g.key ? ' al-master__chip--active' : ''}`}
              onClick={() => setGenre(g.key)}
              disabled={running}
            >
              {g.label}
            </button>
          ))}
        </div>

        <p className="al-master__sub">{t('master.refLabel')}</p>
        <label className="al-master__reframe">
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.m4a"
            className="al-master__file"
            onChange={(e) => setReference(e.target.files?.[0] ?? null)}
          />
          <Music2 size={15} />
          <span>{reference ? reference.name : t('master.refDrop')}</span>
          {reference && (
            <button
              type="button"
              className="al-master__refclear"
              onClick={(e) => {
                e.preventDefault();
                setReference(null);
              }}
            >
              ✕
            </button>
          )}
        </label>
        <p className="al-master__hint">{t('master.refHint')}</p>
      </section>

      {/* 03 LOUDNESS */}
      <section className="al-section">
        <Eyebrow num={3}>{t('master.section.loudness')}</Eyebrow>
        <div className="al-master__loudness">
          {LOUDNESS.map((l) => (
            <button
              key={l.key}
              type="button"
              className={`al-master__loudbtn${loudness === l.key ? ' al-master__loudbtn--active' : ''}`}
              onClick={() => setLoudness(l.key)}
              disabled={running}
            >
              <span className="al-master__loudname">{t(`master.loud.${l.key}`)}</span>
              <span className="al-master__loudval">{l.lufs}</span>
              <span className="al-master__louddesc">{t(`master.loudDesc.${l.key}`)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* RUN */}
      <section className="al-section">
        <Button
          variant="primary"
          size="lg"
          icon={running ? <Loader2 size={18} className="al-spin" /> : <Sparkles size={18} />}
          disabled={running || !file || meta.mastering === false}
          onClick={run}
        >
          {running ? t('master.running') : isDone ? t('master.rerun') : t('master.start')}
        </Button>
        {meta.mastering === false && <p className="al-master__hint">{t('master.unavailable')}</p>}
      </section>

      {(running || isError) && (
        <div className={`al-clean__progress${isError ? ' al-clean__progress--error' : ''}`}>
          {!isError && (
            <div className="al-progressbar" aria-hidden="true">
              <div className="al-progressbar__fill" style={{ width: `${Math.round(pct)}%` }} />
            </div>
          )}
          <div className="al-clean__progressfoot">
            <span className={isError ? 'al-clean__msg--error' : 'al-clean__msg'}>
              {isError ? errorMsg : message}
            </span>
            {!isError && <span className="al-clean__pct">{Math.round(pct)}%</span>}
          </div>
        </div>
      )}

      {/* RESULT */}
      {isDone && resultUrl && (
        <section className="al-section">
          <Eyebrow num={4}>{t('master.section.result')}</Eyebrow>
          <div className="al-master__result">
            <div className="al-master__player">
              <span className="al-master__playerlabel al-master__playerlabel--gold">
                <Disc3 size={13} /> {t('master.mastered')}
              </span>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={resultUrl} controls autoPlay className="al-master__audio" />
            </div>

            {resultMeta && (
              <div className="al-master__stats">
                <Stat label={t('master.stat.loudness')} value={`${resultMeta.outputLufs} LUFS`} sub={`→ ${resultMeta.targetLufs}`} />
                <Stat label={t('master.stat.peak')} value={`${resultMeta.outputPeakDb} dB`} sub={`≤ ${resultMeta.ceilingDb}`} />
                <Stat label={t('master.stat.gain')} value={`${(resultMeta.outputLufs - resultMeta.inputLufs >= 0 ? '+' : '')}${(resultMeta.outputLufs - resultMeta.inputLufs).toFixed(1)} dB`} sub={t('master.stat.gainSub')} />
                <Stat label={t('master.stat.source')} value={resultMeta.referenceUsed ? t('master.stat.reference') : (genres.find((g) => g.key === resultMeta.genre)?.label ?? resultMeta.genre)} sub="" />
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              icon={<Download size={15} />}
              onClick={() => {
                const a = document.createElement('a');
                a.href = resultUrl;
                a.download = 'mastered.wav';
                a.click();
              }}
            >
              {t('master.download')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="al-master__stat">
      <span className="al-master__statlabel">{label}</span>
      <span className="al-master__statvalue">{value}</span>
      {sub && <span className="al-master__statsub">{sub}</span>}
    </div>
  );
}
