import { Cpu, WifiOff } from 'lucide-react';
import { Badge } from '../primitives';
import { useMeta } from '../../state/useMeta';
import type { TabKey } from './tabs';
import { TABS } from './tabs';
import { useT, LanguageToggle } from '../../i18n';

export interface StatusStripProps {
  activeTab: TabKey;
}

/** Top status bar: active mode · GPU/CPU chip (green when online) · version · language toggle. */
export function StatusStrip({ activeTab }: StatusStripProps) {
  const meta = useMeta((s) => s.meta);
  const online = useMeta((s) => s.online);
  const t = useT();
  const tab = TABS.find((t2) => t2.key === activeTab);

  return (
    <div className="al-status">
      <div className="al-status__group">
        <span className="al-status__mode">{tab ? t(tab.labelKey) : ''}</span>
      </div>

      <div className="al-status__group">
        {online ? (
          meta.gpu ? (
            <Badge tone="green" dot title={t('common.status.gpuOnline')}>
              <Cpu size={12} strokeWidth={2} /> GPU
            </Badge>
          ) : (
            <Badge tone="neutral" dot title={t('common.status.cpuOnly')}>
              <Cpu size={12} strokeWidth={2} /> CPU
            </Badge>
          )
        ) : (
          <Badge tone="neutral" title={t('common.status.offlineTitle')}>
            <WifiOff size={12} strokeWidth={2} /> {t('common.status.offline')}
          </Badge>
        )}
        <span className="al-status__version">v{meta.version}</span>
        <LanguageToggle />
      </div>
    </div>
  );
}
