/* ──────────────────────────────────────────────────────────────────
   runMeta — tab-local presentation helpers for the Library tab.
   (No shared module owns these; they're purely display formatting so
   they live with the tab that consumes them.)
   ────────────────────────────────────────────────────────────────── */

import type { JobMode } from '../../api/types';
import type { TFn } from '../../i18n';

// ---------------------------------------------------------------------------
// Mode labels — resolved via t() at the call site so language switches work.
// ---------------------------------------------------------------------------

// Partial: 'speech' (video/subtitle runs) intentionally falls back to the
// generic 'library.mode.auto' label rather than adding a library string.
const MODE_KEY: Partial<Record<JobMode, string>> = {
  auto: 'library.mode.auto',
  biasing: 'library.mode.biasing',
  align: 'library.mode.align',
};

/** Return the localised mode label for the given job mode. */
export function modeLabel(mode: JobMode, t: TFn): string {
  return t(MODE_KEY[mode] ?? 'library.mode.auto');
}

// ---------------------------------------------------------------------------
// Language labels — script names; resolved via t() so 'multi' etc. localise.
// ---------------------------------------------------------------------------

const LANG_KEY: Record<string, string> = {
  zh: 'library.lang.zh',
  yue: 'library.lang.yue',
  en: 'library.lang.en',
  ja: 'library.lang.ja',
  ko: 'library.lang.ko',
  multi: 'library.lang.multi',
  auto: 'library.lang.auto',
};

/** Return the localised language label for a Whisper language code. */
export function languageLabelT(code: string, t: TFn): string {
  if (!code) return '—';
  const key = LANG_KEY[code];
  if (key) return t(key);
  return code.toUpperCase();
}

// ---------------------------------------------------------------------------
// Date formatting helpers
// ---------------------------------------------------------------------------

/** Absolute timestamp: 2026-06-18 14:32 — mono, sortable-looking. */
export function formatRunDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

/**
 * Human relative time — localised. Pass `t` from `useT()` or `makeT(lang)`.
 * E.g. "剛剛" / "just now", "3 分鐘前" / "3m ago".
 */
export function relativeRunDate(ms: number, t: TFn, now = Date.now()): string {
  const sec = Math.max(0, Math.round((now - ms) / 1000));
  if (sec < 45) return t('library.date.justNow');
  const min = Math.round(sec / 60);
  if (min < 60) return t('library.date.minutesAgo', { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('library.date.hoursAgo', { n: hr });
  const day = Math.round(hr / 24);
  if (day < 30) return t('library.date.daysAgo', { n: day });
  return formatRunDate(ms);
}
