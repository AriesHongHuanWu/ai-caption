/* ──────────────────────────────────────────────────────────────────
   i18n public surface. Import from '../i18n' (or relative depth) in
   components: `import { useT } from '../../i18n';`
   ────────────────────────────────────────────────────────────────── */

export type { Lang, Entry, Vars } from './types';
export { useI18n, useT, useLang, makeT } from './useI18n';
export type { TFn } from './useI18n';
export { STRINGS } from './strings';
export { LanguageToggle } from './LanguageToggle';
