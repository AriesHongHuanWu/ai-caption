import { HardDrive } from 'lucide-react';
import { useT } from '../../i18n';

/**
 * LocalAssurance — the local-first footer line. A quiet trust signal for
 * this GPU-first, offline audience: nothing here ever leaves the machine.
 */
export function LocalAssurance() {
  const t = useT();
  return (
    <div className="al-assurance">
      <HardDrive size={14} strokeWidth={1.5} aria-hidden="true" />
      <span>{t('library.assurance')}</span>
    </div>
  );
}
