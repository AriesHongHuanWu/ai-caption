import { SelectField } from '../../components/primitives';
import { useT } from '../../i18n';
import type { LanguageOption } from '../../api/types';

export interface LanguageSelectProps {
  languages: LanguageOption[];
  /** null = auto-detect. */
  value: string | null;
  onChange: (code: string | null) => void;
}

const AUTO = '__auto__';

// Language codes we ship a localized script-name for (shared with the Library
// tab via the library.lang.<code> keys). Unknown server codes fall back to the
// raw meta label so a custom backend language still renders something.
const KNOWN_LANG_KEYS = new Set(['zh', 'yue', 'en', 'ja', 'ko']);

/** Language picker driven by /api/meta languages; Auto + multi supported. */
export function LanguageSelect({ languages, value, onChange }: LanguageSelectProps) {
  const t = useT();

  return (
    <SelectField
      label={t('transcribe.lang.label')}
      value={value ?? AUTO}
      onChange={(e) => onChange(e.target.value === AUTO ? null : e.target.value)}
      hint={t('transcribe.lang.hint')}
    >
      <option value={AUTO}>{t('transcribe.lang.autoDetect')}</option>
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {KNOWN_LANG_KEYS.has(l.code) ? t(`library.lang.${l.code}`) : l.label}
        </option>
      ))}
      <option value="multi">{t('transcribe.lang.multi')}</option>
    </SelectField>
  );
}
