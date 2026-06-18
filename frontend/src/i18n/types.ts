/* ──────────────────────────────────────────────────────────────────
   i18n core types. The whole UI switches between exactly two languages;
   only the ACTIVE language is shown (never both at once).
   ────────────────────────────────────────────────────────────────── */

/** The two supported UI languages. */
export type Lang = 'zh' | 'en';

/** One translatable string, carrying both languages. */
export interface Entry {
  zh: string;
  en: string;
}

/** Optional interpolation variables for `t(key, vars)` → replaces {name}. */
export type Vars = Record<string, string | number>;
