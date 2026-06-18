import { Cpu, Zap } from 'lucide-react';
import { Badge, ProgressBar } from '../../components/primitives';
import { useT } from '../../i18n';

export interface GpuReadoutProps {
  online: boolean;
  gpu: boolean;
  /** Optional live readout; absent → sensible placeholders. */
  gpuName?: string;
  vramUsedGb?: number;
  vramTotalGb?: number;
  cudaBuild?: string;
}

/**
 * Live GPU name + VRAM used/total bar + CUDA build note. Renders fully
 * offline with honest placeholders — never blanks. Accent discipline:
 * green only when the GPU is genuinely online; amber only when VRAM is
 * pressured (event-style), otherwise quiet ink.
 */
export function GpuReadout({
  online,
  gpu,
  gpuName,
  vramUsedGb,
  vramTotalGb,
  cudaBuild,
}: GpuReadoutProps) {
  const t = useT();
  const liveGpu = online && gpu;
  const name =
    gpuName ??
    (liveGpu
      ? 'NVIDIA GeForce RTX 5060'
      : online
        ? t('settings.gpu.cpuOnly')
        : t('settings.gpu.notConnected'));

  const total = vramTotalGb ?? 8; // RTX 5060 8 GB target
  const used = vramUsedGb ?? (liveGpu ? 0 : 0);
  const hasLiveVram = vramUsedGb !== undefined;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const pressured = pct >= 88;

  return (
    <div className="al-panel al-gpu">
      <div className="al-gpu__head">
        <span className="al-gpu__name">
          {liveGpu ? (
            <Zap size={14} strokeWidth={1.9} className="al-gpu__icon al-gpu__icon--live" />
          ) : (
            <Cpu size={14} strokeWidth={1.75} className="al-gpu__icon" />
          )}
          {name}
        </span>
        {online ? (
          gpu ? (
            <Badge tone="green" dot>
              {t('settings.gpu.badgeOnline')}
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              {t('settings.gpu.badgeCpuOnly')}
            </Badge>
          )
        ) : (
          <Badge>{t('settings.gpu.badgeOffline')}</Badge>
        )}
      </div>

      <div className="al-gpu__vram">
        <div className="al-gpu__vram-label">
          <span>VRAM</span>
          <span className={pressured ? 'al-gpu__vram-num al-gpu__vram-num--hot' : 'al-gpu__vram-num'}>
            {hasLiveVram
              ? `${used.toFixed(1)} / ${total.toFixed(0)} GB`
              : `${total.toFixed(0)} GB`}
          </span>
        </div>
        {hasLiveVram && <ProgressBar value={pct} tone={pressured ? 'gold' : 'green'} />}
        {!hasLiveVram && (
          <span className="al-gpu__vram-foot">
            {liveGpu
              ? t('settings.gpu.vramTotal', { total: total.toFixed(0) })
              : online
                ? t('settings.gpu.cpuMode')
                : t('settings.gpu.backendOffline')}
          </span>
        )}
      </div>

      <div className="al-gpu__note">
        CUDA build: <span className="al-gpu__build">{cudaBuild ?? 'cu128 · Blackwell (sm_120)'}</span>
        {' '}— {t('settings.gpu.cudaNote')}
      </div>
    </div>
  );
}
