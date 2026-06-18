/* ──────────────────────────────────────────────────────────────────
   LanguageToggle — a small segmented 中 / EN control.

   On-brand: mono caps, a single hairline outline, gold-tinted active
   segment. Unobtrusive — its natural home is the StatusStrip (top-right)
   beside the GPU chip / version. Switches the WHOLE UI language; only the
   active language is ever shown.
   ────────────────────────────────────────────────────────────────── */

import { useI18n, useT } from './useI18n';
import type { Lang } from './types';
import './language-toggle.css';

const OPTIONS: { lang: Lang; key: string }[] = [
  { lang: 'zh', key: 'common.lang.zh' },
  { lang: 'en', key: 'common.lang.en' },
];

export function LanguageToggle() {
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const t = useT();

  return (
    <div className="al-langtoggle" role="group" aria-label={t('common.lang.aria')}>
      {OPTIONS.map((opt) => {
        const active = opt.lang === lang;
        return (
          <button
            key={opt.lang}
            type="button"
            className={`al-langtoggle__seg ${active ? 'al-langtoggle__seg--active' : ''}`}
            onClick={() => setLang(opt.lang)}
            aria-pressed={active}
            // Labels are language-invariant glyphs (中 / EN), so reading the
            // active-language entry is fine and keeps them stable.
            title={opt.lang === 'zh' ? '中文' : 'English'}
          >
            {t(opt.key)}
          </button>
        );
      })}
    </div>
  );
}
