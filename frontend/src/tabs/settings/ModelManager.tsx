/* ──────────────────────────────────────────────────────────────────
   ModelManager — real, backend-wired version.

   Groups models by kind (Whisper / Demucs / Aligner). Each row:
     • label, description, sizeMB hint, installed badge or download button
     • inline gold progress bar + message while downloading
     • trash icon when installed (guarded for required models)
     • recommended star

   Footer: disk used + cache dir + GPU VRAM total.
   Full keyboard accessibility; aria-live on progress regions.
   ────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react';
import {
  CheckCircle2,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Badge, Button, IconButton, ProgressBar } from '../../components/primitives';
import { useModels } from '../../state/useModels';
import type { ModelInfo, ModelKind } from '../../api/types';
import { useT, makeT, useI18n } from '../../i18n';

// ── section label key map ───────────────────────────────────────────────────
const KIND_KEY: Record<ModelKind, string> = {
  whisper: 'settings.kind.whisper',
  demucs: 'settings.kind.demucs',
  aligner: 'settings.kind.aligner',
};

const KIND_ORDER: ModelKind[] = ['whisper', 'demucs', 'aligner'];

// ── single model row ─────────────────────────────────────────────────────────
function ModelRow({ model }: { model: ModelInfo }) {
  const t = useT();
  const perId = useModels((s) => s.perId);
  const downloadAndTrack = useModels((s) => s.downloadAndTrack);
  const remove = useModels((s) => s.remove);

  const progress = perId[model.id];
  const isDownloading = progress?.status === 'running';
  const isError = progress?.status === 'error';
  const pct = progress?.pct ?? 0;
  const message = progress?.message ?? '';

  const handleDownload = () => void downloadAndTrack(model.id);

  const handleRemove = () => {
    if (model.required) {
      // window.confirm is outside React render — use makeT for a one-shot translation
      const tNow = makeT(useI18n.getState().lang);
      const ok = window.confirm(
        tNow('settings.model.confirmRequired', { name: model.label }),
      );
      if (!ok) return;
    }
    void remove(model.id);
  };

  return (
    <div
      className={[
        'al-modelrow',
        isDownloading ? 'al-modelrow--busy' : '',
        isError ? 'al-modelrow--error' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* ── body ── */}
      <div className="al-modelrow__body">
        <div className="al-modelrow__name">
          {model.label}
          {model.recommended && (
            <span className="al-modelrow__rec" title={t('settings.model.recommendedTitle')}>
              <Star size={9} strokeWidth={2.5} style={{ display: 'inline', marginRight: 2 }} />
              {t('settings.model.recommended')}
            </span>
          )}
          {model.required && (
            <span
              className="al-modelrow__req"
              title={t('settings.model.requiredTitle')}
            >
              {t('settings.model.required')}
            </span>
          )}
        </div>
        <div className="al-modelrow__desc">{model.description}</div>
        <div className="al-modelrow__meta">
          {(model.sizeMB / 1024).toFixed(1)} GB {t('settings.model.sizeDownload')} ·{' '}
          {model.vramHint}
          {model.sizeOnDiskMB > 0 && (
            <>
              {' '}· {t('settings.model.sizeDisk')} {(model.sizeOnDiskMB / 1024).toFixed(1)} GB
            </>
          )}
        </div>

        {/* progress bar — aria-live so screen readers announce updates */}
        {isDownloading && (
          <div
            className="al-modelrow__prog"
            aria-live="polite"
            aria-label={t('settings.model.downloadProgress', { pct: String(Math.round(pct)) })}
          >
            <ProgressBar value={pct} tone="gold" />
            <span className="al-modelrow__pct">
              {Math.round(pct)}% · {message}
            </span>
          </div>
        )}
        {isError && (
          <div className="al-modelrow__errmsg" aria-live="assertive">
            <XCircle size={12} />
            {progress?.error ?? message}
          </div>
        )}
      </div>

      {/* ── actions ── */}
      <div className="al-modelrow__actions">
        {model.installed && !isDownloading && (
          <>
            <Badge tone="green" dot>
              {t('settings.model.installed')}
            </Badge>
            <IconButton
              label={t('settings.model.removeLabel', { name: model.label })}
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={handleRemove}
            />
          </>
        )}
        {!model.installed && !isDownloading && !isError && (
          <Button
            size="sm"
            icon={<Download size={14} />}
            onClick={handleDownload}
          >
            {t('settings.model.download')}
          </Button>
        )}
        {!model.installed && isError && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshCw size={14} />}
            onClick={handleDownload}
          >
            {t('common.action.retry')}
          </Button>
        )}
        {isDownloading && (
          <span className="al-modelrow__spinner" aria-hidden="true">
            <Loader2 size={15} className="al-spin" />
          </span>
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function ModelManager() {
  const t = useT();
  const models = useModels((s) => s.models);
  const diskUsedMB = useModels((s) => s.diskUsedMB);
  const cacheDir = useModels((s) => s.cacheDir);
  const gpuVramTotalMB = useModels((s) => s.gpuVramTotalMB);
  const loading = useModels((s) => s.loading);
  const offline = useModels((s) => s.offline);
  const load = useModels((s) => s.load);

  // Trigger initial load when component mounts (idempotent if already loaded)
  useEffect(() => {
    if (models.length === 0) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (offline && models.length === 0) {
    return (
      <div className="al-panel al-models al-models--offline">
        <span className="al-models__offlinemsg">
          {t('settings.model.offline')}
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={<RefreshCw size={13} />}
          onClick={() => void load()}
        >
          {t('common.action.retry')}
        </Button>
      </div>
    );
  }

  if (loading && models.length === 0) {
    return (
      <div className="al-panel al-models al-models--loading">
        <Loader2 size={16} className="al-spin" />
        <span>{t('settings.model.loading')}</span>
      </div>
    );
  }

  // Group by kind in display order
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    rows: models.filter((m) => m.kind === kind),
  })).filter((g) => g.rows.length > 0);

  const diskGb = (diskUsedMB / 1024).toFixed(1);
  const vramGb = gpuVramTotalMB != null ? (gpuVramTotalMB / 1024).toFixed(0) : null;

  return (
    <div className="al-panel al-models">
      {grouped.map(({ kind, rows }) => (
        <div key={kind} className="al-models__group">
          <div className="al-models__grouplabel">
            <span className="al-models__groupzh">{t(KIND_KEY[kind])}</span>
          </div>
          {rows.map((m) => (
            <ModelRow key={m.id} model={m} />
          ))}
        </div>
      ))}

      {/* ── footer ── */}
      <div className="al-models__foot">
        <span className="al-models__disk">
          <HardDrive size={12} className="al-models__diskicon" />
          {t('settings.model.diskUsed')}:{' '}
          <strong>{diskGb} GB</strong>
        </span>
        <span className="al-models__cache" title={cacheDir}>
          {cacheDir.length > 44 ? '…' + cacheDir.slice(-42) : cacheDir}
        </span>
        {vramGb && (
          <span className="al-models__vram">
            <CheckCircle2 size={11} className="al-models__vramicon" />
            GPU {vramGb} GB VRAM
          </span>
        )}
        <button
          type="button"
          className="al-models__refresh"
          onClick={() => void load()}
          title={t('settings.model.refreshTitle')}
          aria-label={t('settings.model.refreshTitle')}
        >
          <RefreshCw size={12} />
        </button>
      </div>
    </div>
  );
}
