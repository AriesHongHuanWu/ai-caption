/* ──────────────────────────────────────────────────────────────────
   DataLocationPanel — Settings → 資料儲存位置 (Data location).

   Lets the user put the heavy content — engine venv + downloaded models
   + caches — on a drive/folder of their choice (e.g. a roomy D: instead
   of a full C:). Desktop-only; in a plain browser it renders a short
   "桌面版可用" note.

   Flow:
     • Shows the path currently in effect (default vs custom).
     • "變更位置" → native folder picker (open({directory:true})).
       Picking a folder stages it in a confirm card; applying calls the
       Rust `set_data_root` (validates writability) then relaunches so
       the app re-resolves the new location (the first-run wizard then
       rebuilds the engine there; models download to the new drive).
     • "還原預設" (only when custom) → set_data_root(null) + relaunch.

   Changing the location does NOT move existing data — the new place
   starts fresh. We say so plainly before applying.
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { HardDrive, FolderOpen, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/primitives';
import { useDataRoot } from '../../state/useDataRoot';
import { useT } from '../../i18n';

export function DataLocationPanel() {
  const t = useT();
  const inTauri = useDataRoot((s) => s.inTauri);
  const info = useDataRoot((s) => s.info);
  const saving = useDataRoot((s) => s.saving);
  const error = useDataRoot((s) => s.error);
  const load = useDataRoot((s) => s.load);
  const setRoot = useDataRoot((s) => s.setRoot);

  // A folder picked but not yet applied; null = nothing staged. The
  // string '' is the sentinel for "revert to default" staged.
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (inTauri) void load();
  }, [inTauri, load]);

  if (!inTauri) {
    return (
      <div className="al-panel al-dataloc">
        <p className="al-dataloc__note">{t('dataloc.desktopOnly')}</p>
      </div>
    );
  }

  async function pickFolder() {
    try {
      const picked = await open({
        directory: true,
        multiple: false,
        title: t('dataloc.pickTitle'),
      });
      if (typeof picked === 'string' && picked) setPending(picked);
    } catch {
      /* user cancelled / dialog error — leave state untouched */
    }
  }

  async function apply() {
    if (pending === null) return;
    setBusy(true);
    // '' → revert to default (null); otherwise the chosen absolute path.
    const ok = await setRoot(pending === '' ? null : pending);
    if (!ok) {
      setBusy(false);
      return;
    }
    // Relaunch so Rust re-resolves the (new) data root and the first-run
    // wizard rebuilds the engine there. If relaunch is unavailable, fall
    // back to leaving the confirm card with an updated note.
    try {
      await relaunch();
    } catch {
      setBusy(false);
      setPending(null);
    }
  }

  const isCustom = info?.is_custom ?? false;
  const effective = info?.effective ?? '…';

  return (
    <div className="al-panel al-dataloc">
      <div className="al-dataloc__current">
        <HardDrive size={15} className="al-dataloc__icon" />
        <div className="al-dataloc__currentbody">
          <span className="al-dataloc__label">
            {isCustom ? t('dataloc.customLabel') : t('dataloc.defaultLabel')}
          </span>
          <code className="al-dataloc__path">{effective}</code>
        </div>
      </div>

      <p className="al-dataloc__lede">{t('dataloc.lede')}</p>

      {pending === null ? (
        <div className="al-dataloc__actions">
          <Button
            variant="primary"
            size="sm"
            icon={<FolderOpen size={14} />}
            onClick={pickFolder}
          >
            {t('dataloc.change')}
          </Button>
          {isCustom && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw size={13} />}
              onClick={() => setPending('')}
            >
              {t('dataloc.reset')}
            </Button>
          )}
        </div>
      ) : (
        <div className="al-dataloc__confirm">
          <div className="al-dataloc__confirmhead">
            <AlertTriangle size={14} className="al-dataloc__warnicon" />
            <span>{t('dataloc.confirmHead')}</span>
          </div>
          <div className="al-dataloc__confirmtarget">
            <span className="al-dataloc__label">{t('dataloc.newLocation')}</span>
            <code className="al-dataloc__path">
              {pending === '' ? info?.default ?? '…' : pending}
            </code>
          </div>
          <p className="al-dataloc__warn">{t('dataloc.confirmBody')}</p>
          {error && (
            <p className="al-dataloc__error">
              <AlertTriangle size={13} /> {error}
            </p>
          )}
          <div className="al-dataloc__actions">
            <Button
              variant="primary"
              size="sm"
              icon={busy || saving ? <Loader2 size={14} className="al-spin" /> : undefined}
              disabled={busy || saving}
              onClick={apply}
            >
              {busy || saving ? t('dataloc.applying') : t('dataloc.applyRestart')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || saving}
              onClick={() => setPending(null)}
            >
              {t('dataloc.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
