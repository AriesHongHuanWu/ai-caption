import { Globe, Languages, Layers, Scissors, SlidersHorizontal } from 'lucide-react';
import { Pill, SelectField } from '../../components/primitives';
import type { ExportFormat, JobMode, LanguageOption, ModelSize } from '../../api/types';
import { useT } from '../../i18n';

export interface DefaultsValue {
  modelSize: ModelSize;
  language: string | null;
  mode: JobMode;
  exportFormat: ExportFormat;
  separate: boolean;
}

export interface DefaultsPanelProps {
  value: DefaultsValue;
  languages: LanguageOption[];
  modelSizes: ModelSize[];
  /** From meta — gate Demucs + Forced-Align when unavailable. */
  demucsAvailable: boolean;
  alignerAvailable: boolean;
  onChange: (patch: Partial<DefaultsValue>) => void;
}

const AUTO = '__auto__';

const FMT_LABEL: Record<ExportFormat, string> = {
  lrc: 'LRC',
  srt: 'SRT',
  ass: 'ASS karaoke',
  json: 'JSON',
};

/**
 * Default language / mode / export format (+ Demucs default) persisted by
 * the caller to localStorage. These seed the Transcribe/Export forms — so
 * the most common run never needs re-picking.
 */
export function DefaultsPanel({
  value,
  languages,
  modelSizes,
  demucsAvailable,
  alignerAvailable,
  onChange,
}: DefaultsPanelProps) {
  const t = useT();

  return (
    <div className="al-defaults">
      <div className="al-settings__grid">
        <SelectField
          label={t('settings.defaults.modelLabel')}
          hint={t('settings.defaults.modelHint')}
          value={value.modelSize}
          onChange={(e) => onChange({ modelSize: e.target.value as ModelSize })}
        >
          {modelSizes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={t('settings.defaults.langLabel')}
          hint={t('settings.defaults.langHint')}
          value={value.language ?? AUTO}
          onChange={(e) =>
            onChange({ language: e.target.value === AUTO ? null : e.target.value })
          }
        >
          <option value={AUTO}>{t('settings.defaults.langAuto')}</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={t('settings.defaults.modeLabel')}
          hint={t('settings.defaults.modeHint')}
          value={value.mode}
          onChange={(e) => onChange({ mode: e.target.value as JobMode })}
        >
          <option value="auto">Auto · {t('settings.mode.auto')}</option>
          <option value="biasing">Biasing · {t('settings.mode.biasing')}</option>
          <option value="align" disabled={!alignerAvailable}>
            Forced-Align · {t('settings.mode.align')}
            {!alignerAvailable ? ` ${t('settings.mode.alignUnavail')}` : ''}
          </option>
        </SelectField>

        <SelectField
          label={t('settings.defaults.exportLabel')}
          hint={t('settings.defaults.exportHint')}
          value={value.exportFormat}
          onChange={(e) => onChange({ exportFormat: e.target.value as ExportFormat })}
        >
          {(Object.keys(FMT_LABEL) as ExportFormat[]).map((f) => (
            <option key={f} value={f}>
              {FMT_LABEL[f]}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="al-defaults__toggle">
        <Pill
          active={value.separate}
          icon={<Scissors size={13} />}
          onClick={() => demucsAvailable && onChange({ separate: !value.separate })}
          disabled={!demucsAvailable}
          title={
            demucsAvailable
              ? t('settings.defaults.demucsTitle')
              : t('settings.defaults.demucsUnavailTitle')
          }
        >
          {t('settings.defaults.demucsOn')}
        </Pill>
        {!demucsAvailable && (
          <span className="al-defaults__gate">{t('settings.defaults.demucsUnavail')}</span>
        )}
      </div>

      <ul className="al-defaults__legend" aria-hidden="true">
        <li>
          <SlidersHorizontal size={12} /> {t('settings.defaults.legendSeed')}
        </li>
        <li>
          <Languages size={12} /> {t('settings.defaults.legendLang')}
        </li>
        <li>
          <Layers size={12} /> {t('settings.defaults.legendMode')}
        </li>
        <li>
          <Globe size={12} /> {t('settings.defaults.legendLocal')}
        </li>
      </ul>
    </div>
  );
}
