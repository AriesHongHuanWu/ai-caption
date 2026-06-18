/* ──────────────────────────────────────────────────────────────────
   SetupBanner — first-run Whisper model picker (transcribe tab).

   Shown ONLY when useModels().anyWhisperInstalled === false AND the
   backend is reachable.  Now embeds HardwarePanel which:
     1. Shows the user's hardware config (GPU · VRAM · CUDA · CPU · RAM)
     2. Explains the recommendation in plain language
     3. Lets the user pick the recommended OR a different Whisper size
     4. "Download now" → triggers downloadAndTrack  |  "Skip for now"
        dismisses the banner until the user visits Model Manager.

   Disappears automatically when any Whisper model becomes installed.
   Never blocks rendering when the backend is offline.
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { HardwarePanel } from '../../components/setup/HardwarePanel';
import { useModels } from '../../state/useModels';
import { useT } from '../../i18n';

// Whisper model ids scoped to the banner so demucs/aligner downloads don't
// hijack the progress display.
const WHISPER_IDS = [
  'whisper-base',
  'whisper-small',
  'whisper-medium',
  'whisper-large-v3-turbo',
  'whisper-large-v3',
];

export function SetupBanner() {
  const t = useT();
  const anyWhisperInstalled = useModels((s) => s.anyWhisperInstalled);
  const offline = useModels((s) => s.offline);
  const loading = useModels((s) => s.loading);
  const perId = useModels((s) => s.perId);
  const downloadAndTrack = useModels((s) => s.downloadAndTrack);
  const load = useModels((s) => s.load);
  const models = useModels((s) => s.models);

  // The user can dismiss the banner for the session without installing.
  const [dismissed, setDismissed] = useState(false);

  // Kick off a load if the models list is empty.
  useEffect(() => {
    if (models.length === 0 && !offline && !loading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide when installed, offline, dismissed, or still loading the first time.
  if (anyWhisperInstalled || offline || dismissed) return null;
  if (loading && models.length === 0) return null;

  // Find which whisper id is currently downloading (scoped to whisper picks only).
  const activeId = WHISPER_IDS.find((id) => perId[id]?.status === 'running') ?? null;
  const activeProgress = activeId ? perId[activeId] : null;

  return (
    <div
      className="al-setup-banner"
      role="region"
      aria-label={t('transcribe.setup.ariaLabel')}
    >
      {/* Header */}
      <div className="al-setup-banner__head">
        <span className="al-setup-banner__title">
          {t('transcribe.setup.title')}
        </span>
        <span className="al-setup-banner__sub">
          {t('transcribe.setup.sub')}
        </span>
      </div>

      {/* Smart hardware panel */}
      <HardwarePanel
        onDownload={(id) => void downloadAndTrack(id)}
        onSkip={() => setDismissed(true)}
        downloadingId={activeId}
        downloadPct={activeProgress?.pct ?? 0}
        downloadMsg={activeProgress?.message ?? ''}
      />
    </div>
  );
}
