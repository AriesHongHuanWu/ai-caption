/* ──────────────────────────────────────────────────────────────────
   HardwarePanel — hardware readout + smart model picker.

   Used in:
     • SetupScreen (full-screen first-run wizard)
     • SetupBanner (transcribe tab, first-run model download prompt)

   Props:
     onDownload(modelId)  — called when the user clicks "Download now"
     onSkip()             — called when the user clicks "Skip for now"
     downloadingId        — id of the model currently downloading (or null)
     downloadPct          — 0..100 progress for the active download
     downloadMsg          — current download progress message
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Cpu,
  HardDrive,
  Loader2,
  Monitor,
  MemoryStick,
  CheckCircle2,
  Download,
  Star,
} from 'lucide-react';
import { Button, ProgressBar, Eyebrow } from '../primitives';
import { useHardware } from '../../state/useHardware';
import { useT } from '../../i18n';
import type { HardwareTier } from '../../api/types';

// -------------------------------------------------------------------------- //
// Static tier descriptor list — same order as pipeline/hardware.py _TIERS.
// The picker shows every model the backend knows about for this hardware.
// -------------------------------------------------------------------------- //
interface TierDescriptor {
  id: string;
  whisperSize: string;
  descKey: string;
  /** Approximate download size in MB (from models.REGISTRY). */
  sizeMB: number;
}

const WHISPER_SIZES: TierDescriptor[] = [
  {
    id: 'whisper-base',
    whisperSize: 'base',
    descKey: 'hardware.size.base.desc',
    sizeMB: 145,
  },
  {
    id: 'whisper-small',
    whisperSize: 'small',
    descKey: 'hardware.size.small.desc',
    sizeMB: 480,
  },
  {
    id: 'whisper-medium',
    whisperSize: 'medium',
    descKey: 'hardware.size.medium.desc',
    sizeMB: 1530,
  },
  {
    id: 'whisper-large-v3-turbo',
    whisperSize: 'large-v3-turbo',
    descKey: 'hardware.size.large-v3-turbo.desc',
    sizeMB: 1620,
  },
  {
    id: 'whisper-large-v3',
    whisperSize: 'large-v3',
    descKey: 'hardware.size.large-v3.desc',
    sizeMB: 3090,
  },
];

// reasonCode -> i18n key mapping (avoids string-cast hacks)
const REASON_KEY: Record<string, string> = {
  gpu_8gb:  'hardware.reason.gpu_8gb',
  gpu_4gb:  'hardware.reason.gpu_4gb',
  gpu_2gb:  'hardware.reason.gpu_2gb',
  gpu_low:  'hardware.reason.gpu_low',
  cpu_only: 'hardware.reason.cpu_only',
  cpu_weak: 'hardware.reason.cpu_weak',
};

// ─────────────────────────────────────────────────────────────────────────── //

export interface HardwarePanelProps {
  onDownload: (modelId: string) => void;
  onSkip: () => void;
  /** Model id currently downloading, or null / undefined */
  downloadingId?: string | null;
  /** 0..100 progress for the active download */
  downloadPct?: number;
  downloadMsg?: string;
  /**
   * When false, the panel shows the hardware readout + recommendation + picker
   * but DEFERS the Download / Skip actions (and active-download progress),
   * replacing them with a one-line "download after setup" note. Used by the
   * first-run SetupScreen, where no venv exists yet so a model download must not
   * be kicked off — and where 'Skip' would have no banner to dismiss. The
   * post-setup SetupBanner leaves this at its default (true). */
  showActions?: boolean;
  /**
   * When true, the "Skip for now" button is hidden — only "Download" remains.
   * Used by the Settings tab, where there is no banner to dismiss: the panel is
   * a permanent device-aware recommendation, so a Skip action would be a no-op
   * that only adds confusion. Has no effect when showActions is false. */
  hideSkip?: boolean;
}

export function HardwarePanel({
  onDownload,
  onSkip,
  downloadingId,
  downloadPct = 0,
  downloadMsg = '',
  showActions = true,
  hideSkip = false,
}: HardwarePanelProps) {
  const t = useT();
  const hardware = useHardware((s) => s.hardware);
  const loading = useHardware((s) => s.loading);
  const offline = useHardware((s) => s.offline);
  const fetchHw = useHardware((s) => s.fetch);

  // Kick off the hardware fetch once on mount.
  useEffect(() => {
    void fetchHw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local selected model id (defaults to recommended once hardware loads).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Refs to each radio card so the radiogroup can move DOM focus with the
  // arrow keys (WAI-ARIA roving-tabindex contract).
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // When hardware loads, default selection to the recommended model.
  useEffect(() => {
    if (hardware && !selectedId) {
      setSelectedId(hardware.recommended.model);
    }
  }, [hardware, selectedId]);

  // ── Radiogroup keyboard navigation ─────────────────────────────
  // ArrowLeft/Up → previous, ArrowRight/Down → next (wrapping). Moving
  // selection also moves focus to the newly-selected card, satisfying the
  // single-tab-stop + arrow-navigation contract a role="radiogroup" implies.
  function onPickerKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const ids = WHISPER_SIZES.map((s) => s.id);
    const current = selectedId ?? ids[0];
    const idx = Math.max(0, ids.indexOf(current));
    const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    const nextId = ids[(idx + delta + ids.length) % ids.length];
    setSelectedId(nextId);
    cardRefs.current[nextId]?.focus();
  }

  // ── Tier lookup ────────────────────────────────────────────────
  function tierFor(id: string): HardwareTier | undefined {
    return hardware?.tiers.find((t) => t.model === id);
  }

  // ── Format helpers ─────────────────────────────────────────────
  function fmtMb(mb: number | null, unitKey: 'hardware.vram.value' | 'hardware.ram.value'): string {
    if (mb == null) return '—';
    const gb = (mb / 1024).toFixed(1);
    return t(unitKey, { total: `${gb} GB` });
  }

  function truncateCpu(name: string): string {
    return name.length > 42 ? name.slice(0, 40) + '…' : name;
  }

  // ── Render: loading skeleton ────────────────────────────────────
  if (loading) {
    return (
      <div className="al-hw-panel al-hw-panel--loading" aria-busy="true">
        <Loader2 size={14} className="al-spin" aria-hidden="true" />
        <span>{t('hardware.loading')}</span>
      </div>
    );
  }

  // ── Render: backend offline / not yet available ─────────────────
  if (offline || !hardware) {
    return (
      <div className="al-hw-panel al-hw-panel--offline">
        <span className="al-hw-panel__offline-msg">{t('hardware.offline')}</span>
      </div>
    );
  }

  const rec = hardware.recommended;
  const reasonKey = REASON_KEY[rec.reasonCode] ?? 'hardware.reason.cpu_only';
  // When actions are deferred (first-run wizard), there is no download to track,
  // so never surface the progress block in that mode.
  const activeDownloading =
    showActions && downloadingId
      ? WHISPER_SIZES.find((s) => s.id === downloadingId)
      : null;

  return (
    <div className="al-hw-panel" role="region" aria-label={t('hardware.eyebrow')}>

      {/* ── Hardware readout ────────────────────────────────────── */}
      <div className="al-hw-panel__head">
        <Eyebrow>{t('hardware.eyebrow')}</Eyebrow>
      </div>

      <dl className="al-hw-facts">

        {/* GPU */}
        <div className="al-hw-fact">
          <dt className="al-hw-fact__label">
            <Monitor size={11} aria-hidden="true" />
            {t('hardware.gpu.label')}
          </dt>
          <dd className="al-hw-fact__value">
            <span
              className={`al-hw-dot ${hardware.gpu ? 'al-hw-dot--green' : 'al-hw-dot--dim'}`}
              aria-label={hardware.gpu ? t('hardware.gpu.dotOnline') : t('hardware.gpu.dotCpu')}
            />
            {hardware.gpuName ?? t('hardware.gpu.none')}
          </dd>
        </div>

        {/* VRAM — only meaningful when a GPU is present */}
        {hardware.gpu && (
          <div className="al-hw-fact">
            <dt className="al-hw-fact__label">
              <HardDrive size={11} aria-hidden="true" />
              {t('hardware.vram.label')}
            </dt>
            <dd className="al-hw-fact__value">
              {fmtMb(hardware.vramTotalMB, 'hardware.vram.value')}
            </dd>
          </div>
        )}

        {/* CUDA */}
        <div className="al-hw-fact">
          <dt className="al-hw-fact__label">
            <Cpu size={11} aria-hidden="true" />
            {t('hardware.cuda.label')}
          </dt>
          <dd className="al-hw-fact__value">
            {hardware.cuda
              ? hardware.cudaVersion
                ? t('hardware.cuda.available', { ver: hardware.cudaVersion })
                : t('hardware.cuda.availableNoVer')
              : t('hardware.cuda.none')}
          </dd>
        </div>

        {/* CPU */}
        <div className="al-hw-fact">
          <dt className="al-hw-fact__label">
            <Cpu size={11} aria-hidden="true" />
            {t('hardware.cpu.label')}
          </dt>
          <dd className="al-hw-fact__value">
            {t('hardware.cpu.cores', {
              name: truncateCpu(hardware.cpu),
              count: hardware.cpuCount,
            })}
          </dd>
        </div>

        {/* RAM */}
        <div className="al-hw-fact">
          <dt className="al-hw-fact__label">
            <MemoryStick size={11} aria-hidden="true" />
            {t('hardware.ram.label')}
          </dt>
          <dd className="al-hw-fact__value">
            {fmtMb(hardware.ramTotalMB, 'hardware.ram.value')}
          </dd>
        </div>

      </dl>

      {/* ── Recommendation box ──────────────────────────────────── */}
      <div className="al-hw-rec-box">
        <Eyebrow>{t('hardware.rec.eyebrow')}</Eyebrow>
        <p className="al-hw-rec-reason">{t(reasonKey)}</p>
        <div className="al-hw-rec-row">
          <span className="al-hw-rec-kv">
            <span className="al-hw-rec-k">{t('hardware.rec.model')}</span>
            <span className="al-hw-rec-v al-hw-rec-v--model">{rec.whisperSize}</span>
          </span>
          <span className="al-hw-rec-kv">
            <span className="al-hw-rec-k">{t('hardware.rec.device')}</span>
            <span className="al-hw-rec-v">
              {rec.device === 'cuda'
                ? t('hardware.rec.deviceCuda')
                : t('hardware.rec.deviceCpu')}
            </span>
          </span>
        </div>
      </div>

      {/* ── Model picker (hidden while a download is active) ─────── */}
      {!activeDownloading && (
        <>
          <fieldset className="al-hw-picker" aria-label={t('hardware.picker.label')}>
            <legend className="al-hw-picker__legend">
              <Eyebrow>{t('hardware.picker.label')}</Eyebrow>
            </legend>
            <div
              className="al-hw-picker__cards"
              role="radiogroup"
              aria-label={t('hardware.picker.label')}
              onKeyDown={onPickerKeyDown}
            >
              {WHISPER_SIZES.map((opt) => {
                const tier = tierFor(opt.id);
                const isRec = rec.model === opt.id;
                const isSelected = selectedId === opt.id;
                // When the backend hasn't returned this tier, default to fits=true
                // to avoid hiding valid sizes due to a stale/partial response.
                const fits = tier ? tier.fits : true;
                // Why doesn't it fit? With a GPU it's a VRAM ceiling ("Needs more
                // VRAM"); on a GPU-less box there's no VRAM at all, so the honest
                // reason is "Slower on CPU" (hardware.picker.cpuSlow).
                const hasGpu = hardware.cuda || hardware.gpu;
                const sizeGb = (opt.sizeMB / 1024).toFixed(1);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    // Roving tabindex: the selected card is the single tab stop;
                    // the rest are reachable only via arrow keys.
                    tabIndex={isSelected ? 0 : -1}
                    ref={(el) => {
                      cardRefs.current[opt.id] = el;
                    }}
                    className={[
                      'al-hw-pick',
                      isSelected ? 'al-hw-pick--selected' : '',
                      isRec ? 'al-hw-pick--rec' : '',
                      !fits ? 'al-hw-pick--heavy' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedId(opt.id)}
                  >
                    <div className="al-hw-pick__top">
                      <span className="al-hw-pick__size">{opt.whisperSize}</span>
                      <div className="al-hw-pick__badges">
                        {isRec && (
                          <span className="al-hw-pick__badge al-hw-pick__badge--rec">
                            <Star size={9} strokeWidth={2.5} aria-hidden="true" />
                            {t('hardware.picker.rec')}
                          </span>
                        )}
                        {!fits && (
                          <span className="al-hw-pick__badge al-hw-pick__badge--warn">
                            {hasGpu
                              ? t('hardware.picker.heavy')
                              : t('hardware.picker.cpuSlow')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="al-hw-pick__desc">{t(opt.descKey)}</div>
                    <div className="al-hw-pick__foot">
                      <span className="al-hw-pick__size-label">{sizeGb} GB</span>
                      {isSelected && (
                        <CheckCircle2
                          size={13}
                          className="al-hw-pick__check"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ── Action buttons (deferred in the first-run wizard) ── */}
          {showActions ? (
            <div className="al-hw-actions">
              <Button
                variant="primary"
                size="md"
                icon={<Download size={14} />}
                disabled={!selectedId}
                onClick={() => selectedId && onDownload(selectedId)}
              >
                {t('hardware.action.download')}
              </Button>
              {!hideSkip && (
                <Button
                  variant="ghost"
                  size="md"
                  title={t('hardware.action.skipTitle')}
                  onClick={onSkip}
                >
                  {t('hardware.action.skip')}
                </Button>
              )}
            </div>
          ) : (
            <p className="al-hw-defer-note">{t('hardware.action.deferNote')}</p>
          )}
        </>
      )}

      {/* ── Active download progress ─────────────────────────────── */}
      {activeDownloading && (
        <div className="al-hw-progress" aria-live="polite">
          <div className="al-hw-progress__head">
            <Loader2 size={14} className="al-spin" aria-hidden="true" />
            <span className="al-hw-progress__label">
              {t('hardware.action.downloading')} {activeDownloading.whisperSize}…
            </span>
            <span className="al-hw-progress__pct">{Math.round(downloadPct)}%</span>
          </div>
          <ProgressBar value={downloadPct} tone="gold" />
          {downloadMsg && (
            <span className="al-hw-progress__msg">{downloadMsg}</span>
          )}
        </div>
      )}
    </div>
  );
}
