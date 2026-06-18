import { Search, X } from 'lucide-react';
import { useT } from '../../i18n';

export interface RunSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Number of matches currently shown (rendered as a quiet mono count). */
  count: number;
  /** Total runs available (so "3 / 12" reads honestly). */
  total: number;
}

/**
 * RunSearch — filter the run history by name / mode / language.
 * Quiet, single-line. A clear button appears once there's a query.
 */
export function RunSearch({ value, onChange, count, total }: RunSearchProps) {
  const t = useT();
  const filtering = value.trim().length > 0;
  return (
    <div className="al-runsearch" role="search">
      <Search size={15} className="al-runsearch__icon" aria-hidden="true" />
      <input
        type="search"
        className="al-runsearch__input"
        placeholder={t('library.search.placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('library.search.aria')}
        spellCheck={false}
        autoComplete="off"
      />
      <span className="al-runsearch__count" aria-live="polite">
        {filtering ? `${count} / ${total}` : `${total}`}
      </span>
      {filtering && (
        <button
          type="button"
          className="al-runsearch__clear"
          onClick={() => onChange('')}
          aria-label={t('library.search.clearAria')}
          title={t('library.search.clearTitle')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
