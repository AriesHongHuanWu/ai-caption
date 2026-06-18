/* ──────────────────────────────────────────────────────────────────
   useI18n — the language store + the translation hook.

   • useI18n  : zustand store holding the active `lang`, persisted to
                localStorage under 'al-lang'.
   • useT     : a hook that SUBSCRIBES to `lang` and returns a `t()`
                function. Because the returned `t` is recreated whenever
                `lang` changes, every component that calls `const t =
                useT()` re-renders on a language switch — so the whole UI
                flips at once.

   `t(key, vars?)`:
     • looks the key up in the flat STRINGS table, picks the active
       language, and returns that string;
     • falls back to the key itself when a string is missing (so a
       missing translation is visible, never a blank);
     • interpolates {var} placeholders from the optional `vars` record.
   ────────────────────────────────────────────────────────────────── */

import { create } from 'zustand';
import type { Lang, Vars } from './types';
import { STRINGS } from './strings';

const STORAGE_KEY = 'al-lang';

/** localStorage 'al-lang' ?? (navigator.language startsWith 'zh' ? zh : en) ?? zh. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* private mode / no storage — fall through to detection */
  }
  try {
    const nav = navigator.language ?? '';
    if (nav.toLowerCase().startsWith('zh')) return 'zh';
    if (nav) return 'en';
  } catch {
    /* no navigator — fall through */
  }
  return 'zh';
}

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Convenience flip between the two languages. */
  toggle: () => void;
}

export const useI18n = create<I18nState>((set, get) => ({
  lang: initialLang(),
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore quota / private mode */
    }
    // Reflect on <html lang> for a11y + correct font fallback selection.
    try {
      document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
    } catch {
      /* SSR / no document — ignore */
    }
    set({ lang });
  },
  toggle: () => get().setLang(get().lang === 'zh' ? 'en' : 'zh'),
}));

// Apply the initial <html lang> once at module load.
try {
  const l = useI18n.getState().lang;
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
} catch {
  /* ignore */
}

/** Fill {placeholders} in a string from a vars record. */
function interpolate(str: string, vars?: Vars): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** A `t()` function bound to a specific language. */
export type TFn = (key: string, vars?: Vars) => string;

/** Build a `t()` for the given language (pure; used by the hook). */
export function makeT(lang: Lang): TFn {
  return (key, vars) => {
    const entry = STRINGS[key];
    if (!entry) return key; // visible fallback: the key itself
    return interpolate(entry[lang], vars);
  };
}

/**
 * Subscribe to the active language and get a `t()` function.
 *
 * USAGE in any component:
 *   const t = useT();
 *   return <h1>{t('transcribe.title')}</h1>;
 *
 * The component re-renders whenever the language changes, because `t`
 * is derived from the subscribed `lang`.
 */
export function useT(): TFn {
  const lang = useI18n((s) => s.lang);
  return makeT(lang);
}

/** Subscribe to just the active language (when you need the raw value). */
export function useLang(): Lang {
  return useI18n((s) => s.lang);
}
