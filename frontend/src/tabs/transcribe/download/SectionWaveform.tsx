/* ──────────────────────────────────────────────────────────────────
   SectionWaveform — the song's waveform with the detected structure
   (intro / verse / prechorus / chorus / bridge / outro / instrumental)
   overlaid as colored regions with labels. Decodes peaks from the blob
   locally (bounded/decimated) and draws pure SVG, matching the mastering
   visualisations.
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from 'react';
import { decodePeaks, peaksToPath, type PeakData } from '../../../lib/waveform';
import { useLang, useT } from '../../../i18n';
import type { Section } from '../../../api/download';

interface Props {
  media: Blob | File | null;
  sections: Section[];
  durationS: number;
}

const W = 760;
const H = 150;
const PAD = { l: 8, r: 8, t: 10, b: 22 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const LABEL_CLASS: Record<string, string> = {
  intro: 'al-secw__seg--intro',
  verse: 'al-secw__seg--verse',
  prechorus: 'al-secw__seg--prechorus',
  chorus: 'al-secw__seg--chorus',
  bridge: 'al-secw__seg--bridge',
  outro: 'al-secw__seg--outro',
  instrumental: 'al-secw__seg--instrumental',
};

export function SectionWaveform({ media, sections, durationS }: Props) {
  const t = useT();
  const lang = useLang();
  const [peaks, setPeaks] = useState<PeakData | null>(null);

  useEffect(() => {
    let alive = true;
    setPeaks(null);
    if (!media) return;
    decodePeaks(media, 1400).then((p) => { if (alive) setPeaks(p); }).catch(() => { /* leave null */ });
    return () => { alive = false; };
  }, [media]);

  const dur = durationS || peaks?.duration || 1;
  const xAt = (s: number) => PAD.l + (Math.max(0, Math.min(s, dur)) / dur) * PLOT_W;
  const wavePath = useMemo(
    () => (peaks ? peaksToPath(peaks.peaks, PLOT_W, PLOT_H) : ''),
    [peaks],
  );

  const lbl = (s: string) => t(`download.sect.${s}`);

  return (
    <div className="al-secw">
      <svg viewBox={`0 0 ${W} ${H}`} className="al-secw__svg" role="img"
           aria-label={t('download.sect.aria')} preserveAspectRatio="none">
        {/* section regions (behind the waveform) */}
        {sections.map((sec, i) => {
          const x = xAt(sec.start_s);
          const w = Math.max(0, xAt(sec.end_s) - x);
          return (
            <rect key={i} x={x} y={PAD.t} width={w} height={PLOT_H}
                  className={`al-secw__seg ${LABEL_CLASS[sec.label] ?? 'al-secw__seg--verse'}`} />
          );
        })}
        {/* boundaries */}
        {sections.map((sec, i) => (i === 0 ? null : (
          <line key={`b${i}`} x1={xAt(sec.start_s)} y1={PAD.t} x2={xAt(sec.start_s)} y2={PAD.t + PLOT_H}
                className="al-secw__bound" />
        )))}
        {/* waveform */}
        <g transform={`translate(${PAD.l}, ${PAD.t})`}>
          {wavePath && <path d={wavePath} className="al-secw__wave" />}
        </g>
        {/* labels */}
        {sections.map((sec, i) => {
          const cx = (xAt(sec.start_s) + xAt(sec.end_s)) / 2;
          if (xAt(sec.end_s) - xAt(sec.start_s) < 42) return null;
          return (
            <text key={`l${i}`} x={cx} y={H - 7} className="al-secw__lbl" textAnchor="middle">
              {lbl(sec.label)}
            </text>
          );
        })}
      </svg>

      {/* legend: the section types present, in order of first appearance */}
      <div className="al-secw__legend">
        {[...new Set(sections.map((s) => s.label))].map((label) => (
          <span key={label} className="al-secw__key">
            <span className={`al-secw__swatch ${LABEL_CLASS[label] ?? 'al-secw__seg--verse'}`} />
            {lbl(label)}
          </span>
        ))}
        {!peaks && media && <span className="al-secw__loading">{t('download.sect.decoding')}</span>}
      </div>
      <p className="al-secw__hint">{lang === 'en'
        ? 'Structure is auto-detected (self-similarity) — labels are a best-effort guess.'
        : '曲式為自動偵測(自相似分析),段落標記為盡力推測,僅供參考。'}</p>
    </div>
  );
}
