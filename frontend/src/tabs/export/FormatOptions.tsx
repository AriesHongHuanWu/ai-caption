import type { ReactNode } from 'react';
import { Pill } from '../../components/primitives';
import type { ExportLevel } from '../../api/types';
import {
  capabilitiesFor,
  type AssSweepStyle,
  type Encoding,
  type ExportConfig,
} from './exportOptions';
import { useT } from '../../i18n';

export interface FormatOptionsProps {
  config: ExportConfig;
  onChange: (patch: Partial<ExportConfig>) => void;
}

interface SegRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

function OptionRow({ label, hint, children }: SegRowProps) {
  return (
    <div className="al-optrow">
      <div className="al-optrow__label">
        <span>{label}</span>
        {hint && <span className="al-optrow__hint">{hint}</span>}
      </div>
      <div className="al-optrow__controls">{children}</div>
    </div>
  );
}

/** Per-format options — only the groups meaningful to the format are shown. */
export function FormatOptions({ config, onChange }: FormatOptionsProps) {
  const t = useT();
  const caps = capabilitiesFor(config.fmt);

  const sweepOptions: [AssSweepStyle, string][] = [
    ['gradient', t('export.sweepGradient')],
    ['wipe', t('export.sweepWipe')],
    ['fill', t('export.sweepFill')],
  ];

  return (
    <div className="al-options">
      {caps.level && (
        <OptionRow label={t('export.optLevel')}>
          <Pill
            active={config.level === 'line'}
            onClick={() => onChange({ level: 'line' as ExportLevel })}
            title={t('export.optLevelLineTitle')}
          >
            {t('export.levelLine')}
          </Pill>
          <Pill
            active={config.level === 'word'}
            onClick={() => onChange({ level: 'word' as ExportLevel })}
            title={t('export.optLevelWordTitle')}
          >
            {t('export.levelWord')}
          </Pill>
        </OptionRow>
      )}

      {caps.sweep && (
        <OptionRow label={t('export.optSweep')} hint="preview only">
          {sweepOptions.map(([key, lbl]) => (
            <Pill
              key={key}
              active={config.assSweep === key}
              onClick={() => onChange({ assSweep: key })}
            >
              {lbl}
            </Pill>
          ))}
        </OptionRow>
      )}

      {caps.precision && (
        <OptionRow label={t('export.optPrecision')}>
          <Pill
            active={!config.precisionMs}
            onClick={() => onChange({ precisionMs: false })}
            title={t('export.precisionCsTitle')}
          >
            10 ms · cs
          </Pill>
          <Pill
            active={config.precisionMs}
            onClick={() => onChange({ precisionMs: true })}
            title={t('export.precisionMsTitle')}
          >
            1 ms
          </Pill>
        </OptionRow>
      )}

      {caps.encoding && (
        <OptionRow label={t('export.optEncoding')}>
          {(
            [
              ['utf-8', 'UTF-8'],
              ['utf-8-bom', 'UTF-8 BOM'],
            ] as [Encoding, string][]
          ).map(([key, lbl]) => (
            <Pill
              key={key}
              active={config.encoding === key}
              onClick={() => onChange({ encoding: key })}
              title={
                key === 'utf-8-bom'
                  ? t('export.encodingBomTitle')
                  : t('export.encodingUtf8Title')
              }
            >
              {lbl}
            </Pill>
          ))}
        </OptionRow>
      )}
    </div>
  );
}
