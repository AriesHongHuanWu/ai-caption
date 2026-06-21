/* ──────────────────────────────────────────────────────────────────
   SongAnalysisPanel — the deep-analysis result: precise key (+ Camelot,
   alternates, tuning), BPM (+ candidates), genre, loudness, the structure
   waveform, the whole-song EQ distribution, detected elements, and the
   situation-aware vocal-mixing advice library.
   ────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { Music2, Music3, Gauge, Disc3, Activity, Sparkles, Download, Loader2 } from 'lucide-react';
import { useLang, useT } from '../../../i18n';
import { clickTrack, type SongAnalysis } from '../../../api/download';
import { saveBinaryBlob } from '../../export/saveFile';
import { SectionWaveform } from './SectionWaveform';
import { EqDistribution } from './EqDistribution';

interface Props {
  analysis: SongAnalysis;
  media: Blob | File | null;
}

export function SongAnalysisPanel({ analysis, media }: Props) {
  const t = useT();
  const lang = useLang();
  const en = lang === 'en';
  const { key, tempo, genre, loudness, eq, elements, vocalMix, compose } = analysis;
  const [clicking, setClicking] = useState(false);

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  const getClick = async () => {
    const bpm = tempo.bpmRounded || 120;
    setClicking(true);
    try {
      const blob = await clickTrack(bpm);
      await saveBinaryBlob(blob, `click_${bpm}bpm.wav`, { name: 'WAV', extensions: ['wav'] });
    } catch { /* ignore */ } finally { setClicking(false); }
  };

  return (
    <div className="al-songanl">
      {/* headline stats */}
      <div className="al-songanl__stats">
        <div className="al-songanl__stat">
          <span className="al-songanl__statk"><Music2 size={14} /> {t('download.an.key')}</span>
          <span className="al-songanl__statv">{key.name === '—' ? '—' : `${key.tonic} ${en ? key.mode : t('download.mode.' + key.mode)}`}</span>
          <span className="al-songanl__statsub">
            {key.camelot && <b className="al-songanl__camelot">{key.camelot}</b>}
            {' '}{t('download.an.match')} {key.confidence}%
            {key.tuningCents ? ` · ${key.tuningCents > 0 ? '+' : ''}${key.tuningCents}¢` : ''}
          </span>
          {key.alternates.length > 0 && (
            <span className="al-songanl__alts">
              {t('download.an.alt')}: {key.alternates.map((a) => a.name).slice(0, 2).join(', ')}
            </span>
          )}
        </div>

        <div className="al-songanl__stat">
          <span className="al-songanl__statk"><Gauge size={14} /> {t('download.an.tempo')}</span>
          <span className="al-songanl__statv">{tempo.bpmRounded || '—'} <small>BPM</small></span>
          <span className="al-songanl__statsub">
            {t('download.an.conf')} {tempo.confidence}%
            {tempo.candidates.length > 1 && ` · ${tempo.candidates.slice(1, 3).map((c) => Math.round(c.bpm)).join(' / ')}`}
          </span>
        </div>

        <div className="al-songanl__stat">
          <span className="al-songanl__statk"><Disc3 size={14} /> {t('download.an.genre')}</span>
          <span className="al-songanl__statv">{genre.top}</span>
          <span className="al-songanl__statsub">{genre.confidence}% · {fmtDur(analysis.durationS)}</span>
        </div>

        <div className="al-songanl__stat">
          <span className="al-songanl__statk"><Activity size={14} /> {t('download.an.loud')}</span>
          <span className="al-songanl__statv">{loudness.integratedLufs} <small>LUFS</small></span>
          <span className="al-songanl__statsub">
            TP {loudness.truePeakDbtp} dBTP · crest {loudness.crestDb} dB
          </span>
        </div>
      </div>

      {/* compose — scale + chords + progressions from the detected key */}
      {compose && (
        <section className="al-songanl__block al-songanl__compose">
          <h3 className="al-songanl__h">
            <Music3 size={15} /> {t('download.an.compose')}
            <button type="button" className="al-songanl__clickbtn" disabled={clicking} onClick={getClick}
                    title={t('download.an.clickHint')}>
              {clicking ? <Loader2 size={13} className="al-spin" /> : <Download size={13} />}
              {t('download.an.click')} · {tempo.bpmRounded || '?'} BPM
            </button>
          </h3>

          <div className="al-songanl__scaleline">
            <span className="al-songanl__scalek">{compose.scaleName}</span>
            <span className="al-songanl__scale">{compose.scale.join('  ')}</span>
            <span className="al-songanl__rel">{compose.relative.label}: {compose.relative.key}</span>
          </div>

          <div className="al-songanl__chordgrid">
            {compose.diatonic.map((d) => (
              <div key={d.degree} className="al-songanl__chord">
                <span className="al-songanl__roman">{d.roman}</span>
                <span className="al-songanl__chordname">{d.triad}</span>
                <span className="al-songanl__seventh">{d.seventh}</span>
              </div>
            ))}
          </div>

          <div className="al-songanl__progs">
            <span className="al-songanl__progslabel">{t('download.an.progressions')}</span>
            {compose.progressions.map((p, i) => (
              <div key={i} className="al-songanl__prog">
                <span className="al-songanl__progname">{p.name}</span>
                <span className="al-songanl__progchords">{p.chords}</span>
              </div>
            ))}
          </div>

          <div className="al-songanl__borrowed">
            {compose.borrowed.map((b, i) => (
              <span key={i} className="al-songanl__borrowchip" title={b.label}>
                <b>{b.chord}</b> {b.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* structure */}
      <section className="al-songanl__block">
        <h3 className="al-songanl__h">{t('download.an.structure')}</h3>
        <SectionWaveform media={media} sections={analysis.sections} durationS={analysis.durationS} />
      </section>

      {/* EQ distribution */}
      <section className="al-songanl__block">
        <h3 className="al-songanl__h">{t('download.an.eqdist')}</h3>
        <EqDistribution bands={eq.bands} spectrum={eq.spectrum} tiltDbOct={eq.tiltDbOct} centroidHz={eq.centroidHz} />
      </section>

      {/* elements */}
      {elements.length > 0 && (
        <section className="al-songanl__block">
          <h3 className="al-songanl__h">{t('download.an.elements')}</h3>
          <div className="al-songanl__elements">
            {elements.map((e) => (
              <span key={e.id} className={`al-songanl__el al-songanl__el--${e.kind}`}
                    title={en ? e.detailEn : e.detail}>
                {en ? e.labelEn : e.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* vocal mixing advice */}
      {vocalMix && (
        <section className="al-songanl__block al-songanl__advice">
          <h3 className="al-songanl__h"><Sparkles size={15} /> {t('download.an.vocalmix')}</h3>
          <p className="al-songanl__summary">{en ? vocalMix.summary.en : vocalMix.summary.zh}</p>
          <div className="al-songanl__ctx">
            {vocalMix.context.map((c, i) => (
              <span key={i} className="al-songanl__ctxchip">
                <b>{en ? c.labelEn : c.label}</b> {c.value}
              </span>
            ))}
          </div>
          <div className="al-songanl__groups">
            {vocalMix.groups.map((g) => (
              <div key={g.id} className="al-songanl__group">
                <div className="al-songanl__grouptitle">{en ? g.titleEn : g.title}</div>
                <ul className="al-songanl__items">
                  {g.items.map((it, i) => (
                    <li key={i} className="al-songanl__item">
                      <span className="al-songanl__itemtext">{en ? it.textEn : it.text}</span>
                      {it.spec && <span className="al-songanl__spec">{it.spec}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
