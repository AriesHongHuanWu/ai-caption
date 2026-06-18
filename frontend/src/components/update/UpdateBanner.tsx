/* ──────────────────────────────────────────────────────────────────
   UpdateBanner — On-brand floating strip that appears when an update
   is available.  Renders as a portal-free overlay at the top of
   AppFrame so it is always above the tab content but below the
   titlebar drag region.

   Visibility rules:
     • Only renders inside Tauri (guarded via IN_TAURI).
     • Hidden when dismissed === true or status === 'idle' / 'checking'.
     • Shows download progress bar while status === 'downloading'.
     • Shows "installing / restarting" message while status === 'ready'.
     • Shows error + retry when status === 'error'.
   ────────────────────────────────────────────────────────────────── */

import { Download, RefreshCw, X, AlertTriangle, Sparkles } from 'lucide-react';
import { useUpdater } from '../../state/useUpdater';
import { Button } from '../primitives';
import { ProgressBar } from '../primitives';
import { useT } from '../../i18n';
import './update.css';

const IN_TAURI = '__TAURI_INTERNALS__' in window;

export function UpdateBanner() {
  const t = useT();
  const { status, version, notes, progress, error, dismissed, downloadAndInstall, dismiss, checkNow } =
    useUpdater();

  // The banner is a passively-surfaced, non-modal strip. We deliberately do NOT
  // programmatically move focus to it: the aria-live region announces it to
  // screen-reader users, and keyboard users can Tab to its actions. Auto-focusing
  // would yank focus mid-task (WCAG 2.4.3 / focus-management anti-pattern).

  // Not inside Tauri — never render.
  if (!IN_TAURI) return null;

  // Nothing to show.
  const isVisible =
    (status === 'available' && !dismissed) ||
    status === 'downloading' ||
    status === 'ready' ||
    status === 'error';

  if (!isVisible) return null;

  // ── Error state ────────────────────────────────────────────────────────────
  if (status === 'error') {
    const offlineMsg = error === '__offline__';
    return (
      <div className="al-update-banner al-update-banner--error" role="alert" aria-live="assertive">
        <AlertTriangle size={15} className="al-update-banner__icon al-update-banner__icon--error" aria-hidden />
        <span className="al-update-banner__msg">
          {offlineMsg ? t('update.errorOffline') : `${t('update.errorCheck')}: ${error ?? ''}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={13} />}
          onClick={() => void checkNow()}
          aria-label={t('update.retry')}
        >
          {t('update.retry')}
        </Button>
        <button
          type="button"
          className="al-update-banner__dismiss"
          onClick={dismiss}
          aria-label={t('update.later')}
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  // ── Downloading / installing state ─────────────────────────────────────────
  if (status === 'downloading' || status === 'ready') {
    const isReady = status === 'ready';
    const pctLabel = t('update.progressLabel', { pct: String(progress) });
    return (
      <div
        className="al-update-banner al-update-banner--progress"
        role="status"
        aria-live="polite"
        aria-label={pctLabel}
      >
        <Download size={15} className="al-update-banner__icon" aria-hidden />
        <span className="al-update-banner__msg">
          {isReady
            ? t('update.installing')
            : progress > 0
              ? t('update.downloading', { pct: String(progress) })
              : t('update.downloadingIndeterminate')}
        </span>
        <ProgressBar
          value={progress}
          indeterminate={progress === 0 && !isReady}
          tone="gold"
          className="al-update-banner__bar"
        />
      </div>
    );
  }

  // ── Available state ────────────────────────────────────────────────────────
  const versionLabel = version
    ? t('update.titleWithVersion', { version })
    : t('update.title');

  return (
    <div
      className="al-update-banner al-update-banner--available"
      role="status"
      aria-live="polite"
    >
      <Sparkles size={15} className="al-update-banner__icon al-update-banner__icon--gold" aria-hidden />

      <div className="al-update-banner__body">
        <span className="al-update-banner__heading">{versionLabel}</span>
        {notes && (
          <span className="al-update-banner__notes" aria-label={`${t('update.notes')}: ${notes}`}>
            {notes.length > 120 ? notes.slice(0, 120).trimEnd() + '…' : notes}
          </span>
        )}
      </div>

      <div className="al-update-banner__actions">
        <Button
          variant="primary"
          size="sm"
          icon={<Download size={13} />}
          onClick={() => void downloadAndInstall()}
          aria-label={t('update.install')}
        >
          {t('update.install')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          aria-label={t('update.later')}
        >
          {t('update.later')}
        </Button>
      </div>

      <button
        type="button"
        className="al-update-banner__dismiss"
        onClick={dismiss}
        aria-label={t('update.later')}
      >
        <X size={13} />
      </button>
    </div>
  );
}
