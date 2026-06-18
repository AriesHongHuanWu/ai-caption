/* ──────────────────────────────────────────────────────────────────
   SetupScreen — full-screen first-run wizard.

   Shown ONLY when useSetup().needsSetup is true (i.e. we are inside
   the Tauri shell AND the backend venv does not yet exist).

   Never rendered in plain-browser / vite-dev mode.

   Phases:
     1. python-missing  — user needs to install Python first.
     2. ready-to-install — venv absent but Python found; show CTA.
     3. running          — live scrolling log + gold progress bar.
     4. error            — show error + Retry.
     (needsSetup → false once venv exists → wizard unmounts, normal
      app renders, the existing SetupBanner model-picker takes over.)
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useRef } from 'react';
import { ExternalLink, RefreshCw, Terminal, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button, ProgressBar, Eyebrow } from '../primitives';
import { useSetup } from '../../state/useSetup';
import { useT } from '../../i18n';
import { HardwarePanel } from './HardwarePanel';
import './setup.css';

// Cap the rendered log to the tail — Rust streams every line but the user only
// ever sees the bottom, and a multi-GB torch install emits hundreds of lines.
// Re-mapping the full array into <div>s on every line would make the wizard janky.
const LOG_TAIL = 200;

export function SetupScreen() {
  const t = useT();

  // Granular selectors: each setup-progress line mutates the store once, so a
  // bare destructure of the whole store would re-render this component on every
  // stdout line. Subscribe only to the fields we actually read.
  const pythonFound = useSetup((s) => s.pythonFound);
  const running = useSetup((s) => s.running);
  const progressLines = useSetup((s) => s.progressLines);
  const pct = useSetup((s) => s.pct);
  const error = useSetup((s) => s.error);
  const status = useSetup((s) => s.status);
  const done = useSetup((s) => s.done);
  const checkStatus = useSetup((s) => s.checkStatus);
  const runSetup = useSetup((s) => s.runSetup);
  const cancelSetup = useSetup((s) => s.cancelSetup);

  // Only the tail is rendered (see LOG_TAIL).
  const logLines = progressLines.length > LOG_TAIL ? progressLines.slice(-LOG_TAIL) : progressLines;

  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the log to the bottom as new lines arrive.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logLines]);

  // Check status once on mount so we have up-to-date info. On unmount (e.g.
  // window closed mid-install, or needsSetup flips), release any dangling
  // setup-event listeners.
  useEffect(() => {
    void checkStatus();
    return () => cancelSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive phase ──────────────────────────────────────────────────
  const isRunning = running;
  // Authoritative success flag from the store (set on setup-done success).
  // This typically shows only briefly: checkStatus() flips needsSetup→false
  // and App.tsx unmounts this screen, then polls /api/meta until the freshly
  // spawned backend answers. Basing this on `done` (not a pct heuristic)
  // prevents falling through to the readyToInstall phase with a stale log.
  const isDone = !running && !error && done;
  const hasError = Boolean(error) && !running;
  const needsPython = status !== null && !pythonFound;
  const readyToInstall = status !== null && pythonFound && !isRunning && !isDone && !hasError;

  return (
    <div className="al-setup-screen" role="main" aria-label={t('setup.aria')}>
      {/* ── Logo / heading ── */}
      <header className="al-setup-screen__head">
        <div className="al-setup-screen__mark">◆</div>
        <h1 className="al-setup-screen__title">AutoLyrics</h1>
        <p className="al-setup-screen__sub">{t('setup.sub')}</p>
      </header>

      {/* ── Card ── */}
      <div className="al-setup-screen__card">

        {/* ── Phase 1: Python not found ── */}
        {needsPython && !isRunning && (
          <section className="al-setup-phase" aria-label={t('setup.python.aria')}>
            <Eyebrow>{t('setup.step1')}</Eyebrow>
            <div className="al-setup-phase__icon al-setup-phase__icon--warn">
              <AlertTriangle size={22} />
            </div>
            <h2 className="al-setup-phase__heading">{t('setup.python.heading')}</h2>
            <p className="al-setup-phase__body">{t('setup.python.body')}</p>
            <div className="al-setup-phase__actions">
              <a
                href="https://www.python.org/downloads/"
                target="_blank"
                rel="noreferrer"
                className="al-setup-link"
              >
                <ExternalLink size={13} />
                python.org/downloads
              </a>
              <Button
                variant="default"
                size="md"
                icon={<RefreshCw size={14} />}
                onClick={() => void checkStatus()}
              >
                {t('setup.python.recheck')}
              </Button>
            </div>
          </section>
        )}

        {/* ── Phase 2: Ready to install ── */}
        {readyToInstall && (
          <section className="al-setup-phase" aria-label={t('setup.install.aria')}>
            <Eyebrow>{t('setup.step2')}</Eyebrow>
            <div className="al-setup-phase__icon al-setup-phase__icon--gold">
              <Terminal size={22} />
            </div>
            <h2 className="al-setup-phase__heading">{t('setup.install.heading')}</h2>
            <p className="al-setup-phase__body">{t('setup.install.body')}</p>
            {status?.python_version && (
              <p className="al-setup-phase__meta">
                <span className="al-setup-phase__meta-label">Python</span>
                {status.python_version}
              </p>
            )}
            {status?.backend_dir && (
              <p className="al-setup-phase__meta">
                <span className="al-setup-phase__meta-label">{t('setup.install.dirLabel')}</span>
                <span className="al-setup-phase__meta-path">{status.backend_dir}</span>
              </p>
            )}
            <div className="al-setup-phase__actions">
              <Button
                variant="primary"
                size="lg"
                onClick={() => void runSetup()}
              >
                {t('setup.install.cta')}
              </Button>
            </div>
          </section>
        )}

        {/* ── Hardware panel (shown after Phase 2 CTA; backend is reachable now) ──
            Pre-install we surface the hardware readout + recommendation ONLY:
            showActions={false} defers the actual model download to the post-setup
            SetupBanner. Kicking off an HF download before the venv/torch exists
            would hit an unready backend path and its progress would vanish the
            moment the user clicks Install (this section unmounts on isRunning).
            With actions deferred there is no dead 'Skip' and no dropped download. */}
        {readyToInstall && (
          <section className="al-setup-phase al-setup-phase--hw" aria-label={t('hardware.eyebrow')}>
            <HardwarePanel
              showActions={false}
              onDownload={() => {/* deferred until after setup (see SetupBanner) */}}
              onSkip={() => {/* deferred until after setup (see SetupBanner) */}}
            />
          </section>
        )}

        {/* ── Phase 3: Running ── */}
        {isRunning && (
          <section className="al-setup-phase" aria-label={t('setup.running.aria')} aria-live="polite">
            <div className="al-setup-phase__running-head">
              <Loader2 size={16} className="al-spin" />
              <span className="al-setup-phase__running-label">
                {progressLines.length === 0
                  ? t('setup.running.starting')
                  : pct < 30
                  ? t('setup.running.venv')
                  : pct < 70
                  ? t('setup.running.download')
                  : t('setup.running.installing')}
              </span>
              {progressLines.length > 0 && (
                <span className="al-setup-phase__running-pct">{Math.round(pct)}%</span>
              )}
            </div>
            {/* Before the first stdout line arrives, show motion so the user
                always sees feedback the instant they click the install CTA. */}
            <ProgressBar
              value={pct}
              tone="gold"
              indeterminate={progressLines.length === 0}
            />
            <p className="al-setup-phase__note">{t('setup.running.note')}</p>
            {/* Live log (tail only) */}
            <div
              ref={logRef}
              className="al-setup-log"
              role="log"
              aria-label={t('setup.running.logAria')}
              aria-live="polite"
              aria-atomic="false"
            >
              {logLines.map((line, i) => (
                <div key={i} className="al-setup-log__line">
                  {line}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Phase 4: Error ── */}
        {hasError && (
          <section className="al-setup-phase" aria-label={t('setup.error.aria')}>
            <div className="al-setup-phase__icon al-setup-phase__icon--error">
              <AlertTriangle size={22} />
            </div>
            <h2 className="al-setup-phase__heading al-setup-phase__heading--error">
              {t('setup.error.heading')}
            </h2>
            <p className="al-setup-phase__body">{error}</p>
            {logLines.length > 0 && (
              <div ref={logRef} className="al-setup-log al-setup-log--error">
                {logLines.map((line, i) => (
                  <div key={i} className="al-setup-log__line">
                    {line}
                  </div>
                ))}
              </div>
            )}
            <div className="al-setup-phase__actions">
              <Button
                variant="primary"
                size="md"
                icon={<RefreshCw size={14} />}
                onClick={() => void runSetup()}
              >
                {t('setup.error.retry')}
              </Button>
            </div>
          </section>
        )}

        {/* ── Phase 5: Success (brief, before needsSetup flips) ── */}
        {isDone && !hasError && (
          <section className="al-setup-phase" aria-label={t('setup.done.aria')}>
            <div className="al-setup-phase__icon al-setup-phase__icon--green">
              <CheckCircle2 size={22} />
            </div>
            <h2 className="al-setup-phase__heading al-setup-phase__heading--green">
              {t('setup.done.heading')}
            </h2>
            <p className="al-setup-phase__body">{t('setup.done.body')}</p>
            <ProgressBar value={100} tone="green" />
          </section>
        )}

        {/* ── Status not yet loaded (initial skeleton) ── */}
        {status === null && !isRunning && (
          <section className="al-setup-phase al-setup-phase--loading">
            <Loader2 size={18} className="al-spin" />
            <span>{t('setup.checking')}</span>
          </section>
        )}
      </div>

      <footer className="al-setup-screen__foot">
        <span>{t('setup.foot')}</span>
      </footer>
    </div>
  );
}
