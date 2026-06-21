/* ──────────────────────────────────────────────────────────────────
   EqDistribution — the whole-song frequency balance: the smoothed
   spectrum curve (log-x) plus per-band energy bars relative to the
   track's own mean (gold = forward, amber = recessed). Pure SVG.
   ────────────────────────────────────────────────────────────────── */

import { useLang, useT } from '../../../i18n';
import type { EqBand } from '../../../api/download';

interface Props {
  bands: EqBand[];
  spectrum: { f: number; db: number }[];
  tiltDbOct: number;
  centroidHz: number;
}

const W = 760;
const H = 200;
const PAD = { l: 34, r: 10, t: 12, b: 28 };
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;
const FMIN = 20;
const FMAX = 20000;

const BAND_ZH: Record<string, string> = {
  sub: '極低 Sub', bass: '低頻 Bass', low_mid: '低中 Low-mid', mid: '中頻 Mid',
  high_mid: '高中 Hi-mid', presence: '臨場 Presence', air: '空氣 Air',
};

const logX = (f: number) =>
  PAD.l + (Math.log10(Math.max(FMIN, Math.min(f, FMAX)) / FMIN) / Math.log10(FMAX / FMIN)) * PLOT_W;

export function EqDistribution({ bands, spectrum, tiltDbOct, centroidHz }: Props) {
  const t = useT();
  const lang = useLang();
  const range = Math.max(8, ...bands.map((b) => Math.abs(b.db)), ...spectrum.map((s) => Math.abs(s.db)));
  const midY = PAD.t + PLOT_H / 2;
  const yAt = (db: number) => midY - (db / range) * (PLOT_H * 0.46);

  const specPts = spectrum.map((s) => `${logX(s.f).toFixed(1)},${yAt(s.db).toFixed(1)}`).join(' ');
  const barW = Math.min(64, (PLOT_W / bands.length) * 0.62);

  return (
    <div className="al-eqd">
      <svg viewBox={`0 0 ${W} ${H}`} className="al-eqd__svg" role="img"
           aria-label={t('download.eq.aria')} preserveAspectRatio="none">
        {/* zero baseline + frequency grid */}
        <line x1={PAD.l} y1={midY} x2={PAD.l + PLOT_W} y2={midY} className="al-eqd__zero" />
        {[100, 1000, 10000].map((f) => (
          <g key={f}>
            <line x1={logX(f)} y1={PAD.t} x2={logX(f)} y2={PAD.t + PLOT_H} className="al-eqd__grid" />
            <text x={logX(f)} y={H - 8} className="al-eqd__axis" textAnchor="middle">
              {f >= 1000 ? `${f / 1000}k` : f}
            </text>
          </g>
        ))}
        <text x={PAD.l - 6} y={midY + 3} className="al-eqd__axis" textAnchor="end">0</text>
        <text x={PAD.l - 6} y={yAt(range * 0.9) + 3} className="al-eqd__axis" textAnchor="end">+</text>
        <text x={PAD.l - 6} y={yAt(-range * 0.9) + 3} className="al-eqd__axis" textAnchor="end">−</text>

        {/* band bars */}
        {bands.map((b) => {
          const x = logX(b.centerHz);
          const y = yAt(b.db);
          const h = Math.abs(midY - y);
          const up = b.db >= 0;
          return (
            <rect key={b.name} x={x - barW / 2} y={up ? y : midY} width={barW} height={Math.max(1, h)}
                  className={`al-eqd__bar ${up ? 'al-eqd__bar--up' : 'al-eqd__bar--dn'}`} />
          );
        })}

        {/* smoothed spectrum curve */}
        {specPts && <polyline points={specPts} className="al-eqd__spec" fill="none" />}
      </svg>

      <div className="al-eqd__legend">
        <span className="al-eqd__chip">{lang === 'en' ? 'Tilt' : '傾斜'} {tiltDbOct.toFixed(1)} dB/oct</span>
        <span className="al-eqd__chip">{lang === 'en' ? 'Centroid' : '頻譜形心'} {centroidHz} Hz</span>
        {bands.map((b) => (
          <span key={b.name} className="al-eqd__bandlbl">
            {(lang === 'en' ? b.name : BAND_ZH[b.name] ?? b.name)}: {b.db > 0 ? '+' : ''}{b.db} dB
          </span>
        ))}
      </div>
    </div>
  );
}
