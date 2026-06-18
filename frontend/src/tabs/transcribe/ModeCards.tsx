import { useRef } from 'react';
import { Sparkles, Target, Crosshair, type LucideIcon } from 'lucide-react';
import { ProgressBar } from '../../components/primitives';
import { useT } from '../../i18n';
import type { JobMode } from '../../api/types';

export interface ModeCardsProps {
  value: JobMode;
  onChange: (mode: JobMode) => void;
  /** Forced-Align availability (meta.aligner). */
  alignerEnabled: boolean;
  /** 0..1 readiness per mode, computed from supplied reference + style. */
  readiness: Record<JobMode, number>;
}

interface ModeDef {
  key: JobMode;
  /** i18n key prefix — we look up .zh (title) / .desc / .meterNote from it. */
  i18nPrefix: string;
  icon: LucideIcon;
}

const MODES: ModeDef[] = [
  { key: 'auto',    i18nPrefix: 'transcribe.mode.auto',    icon: Sparkles  },
  { key: 'biasing', i18nPrefix: 'transcribe.mode.biasing', icon: Target    },
  { key: 'align',   i18nPrefix: 'transcribe.mode.align',   icon: Crosshair },
];

const ORDER: JobMode[] = ['auto', 'biasing', 'align'];

/** Three first-class mode cards, each with a plain-language readiness meter. */
export function ModeCards({ value, onChange, alignerEnabled, readiness }: ModeCardsProps) {
  const t = useT();

  const refs = useRef<Record<JobMode, HTMLButtonElement | null>>({
    auto: null,
    biasing: null,
    align: null,
  });

  const isDisabled = (key: JobMode) => key === 'align' && !alignerEnabled;

  // roving radiogroup: arrow keys move selection across enabled cards
  const onKeyNav = (e: React.KeyboardEvent, key: JobMode) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp')
      return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const idx = ORDER.indexOf(key);
    const n = ORDER.length;
    for (let step = 1; step <= n; step++) {
      const next = ORDER[(((idx + dir * step) % n) + n) % n];
      if (!isDisabled(next)) {
        onChange(next);
        refs.current[next]?.focus();
        return;
      }
    }
  };

  return (
    <div
      className="al-modecards"
      role="radiogroup"
      aria-label={t('transcribe.mode.radiogroup')}
    >
      {MODES.map((m) => {
        const disabled = isDisabled(m.key);
        const active = value === m.key;
        const r = Math.round((readiness[m.key] ?? 0) * 100);
        const Icon = m.icon;
        const ready = r >= 80;
        const label = t(`${m.i18nPrefix}.zh`);
        return (
          <button
            key={m.key}
            ref={(el) => {
              refs.current[m.key] = el;
            }}
            type="button"
            className={`al-modecard${active ? ' al-modecard--active' : ''}`}
            onClick={() => !disabled && onChange(m.key)}
            onKeyDown={(e) => onKeyNav(e, m.key)}
            disabled={disabled}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={disabled ? t('transcribe.mode.alignerUnavailable') : label}
          >
            <div className="al-modecard__head">
              <span className="al-modecard__icon" aria-hidden="true">
                <Icon size={17} strokeWidth={1.75} />
              </span>
              <span className="al-modecard__titles">
                <span className="al-modecard__title">{label}</span>
              </span>
            </div>

            <span className="al-modecard__desc">{t(`${m.i18nPrefix}.desc`)}</span>

            <div className="al-readiness">
              <div className="al-readiness__label">
                <span>{t(`${m.i18nPrefix}.meterNote`)}</span>
                <span className={ready ? 'al-readiness__pct--ready' : ''}>{r}%</span>
              </div>
              <ProgressBar value={r} tone={ready ? 'green' : 'gold'} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
