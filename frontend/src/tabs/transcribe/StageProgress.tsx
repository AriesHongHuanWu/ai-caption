import { ArrowRight, Check, Loader2, AlertTriangle } from 'lucide-react';
import { Button, ProgressBar } from '../../components/primitives';
import { useT } from '../../i18n';
import type { JobStatusValue } from '../../api/types';

export interface StageProgressProps {
  status: JobStatusValue | 'idle';
  stage: string;
  pct: number;
  message: string;
  error: string | null;
  elapsedSec: number;
  /** Hand-off when done. */
  onOpenEditor: () => void;
}

/** Maps pct → which stage index is active (rough thirds; 3 = all done). */
function activeStage(status: JobStatusValue | 'idle', pct: number): number {
  if (status === 'done') return 3;
  if (pct >= 66) return 2;
  if (pct >= 33) return 1;
  return 0;
}

/** 3-stage pipeline stepper bound to useJob. */
export function StageProgress({
  status,
  stage,
  pct,
  message,
  error,
  elapsedSec,
  onOpenEditor,
}: StageProgressProps) {
  const t = useT();

  const STAGES = [
    { key: 'separate',  label: t('transcribe.stage.separate')  },
    { key: 'recognize', label: t('transcribe.stage.recognize') },
    { key: 'done',      label: t('transcribe.stage.done')      },
  ];

  const active = activeStage(status, pct);
  const done = status === 'done';
  const errored = status === 'error';
  const queued = status === 'queued';

  return (
    <div className={`al-stages${done ? ' al-stages--done' : ''}${errored ? ' al-stages--error' : ''}`}>
      <div className="al-stages__row" role="list" aria-label={t('transcribe.stage.aria')}>
        {STAGES.map((s, i) => {
          const isDone = active > i;
          // last stage only lights up once the whole run is done
          const isActive = !done && !errored && active === i && i < STAGES.length;
          const isError = errored && active === i;
          const cls = [
            'al-stage',
            isActive ? 'al-stage--active' : '',
            isDone ? 'al-stage--done' : '',
            isError ? 'al-stage--error' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div className="al-stage-wrap" key={s.key} role="listitem">
              <div className={cls}>
                <span className="al-stage__dot">
                  {isDone ? (
                    <Check size={13} strokeWidth={2.5} />
                  ) : isError ? (
                    <AlertTriangle size={12} strokeWidth={2.5} />
                  ) : isActive ? (
                    <Loader2 size={13} className="al-spin" strokeWidth={2.5} />
                  ) : (
                    <span className="al-stage__num">{i + 1}</span>
                  )}
                </span>
                <span className="al-stage__label">
                  <span className="al-stage__zh">{s.label}</span>
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span className={`al-stage__sep${active > i ? ' al-stage__sep--filled' : ''}`} />
              )}
            </div>
          );
        })}
      </div>

      <ProgressBar
        value={errored ? 100 : pct}
        indeterminate={queued && pct === 0}
        tone={done ? 'green' : 'gold'}
      />

      <div className="al-stages__foot">
        <span
          className={errored ? 'al-stages__msg--error' : 'al-stages__msg'}
          role={errored ? 'alert' : 'status'}
          aria-live={errored ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {errored
            ? (error ?? t('transcribe.stage.errorFallback'))
            : (message || stage || t('transcribe.stage.preparing'))}
        </span>
        <span className="al-stages__clock" aria-hidden="true">
          {elapsedSec.toFixed(1)}s · {Math.round(pct)}%
        </span>
      </div>

      {done && (
        <div className="al-handoff">
          <Button variant="primary" icon={<ArrowRight size={16} />} onClick={onOpenEditor}>
            {t('transcribe.stage.openInEditor')}
          </Button>
        </div>
      )}
    </div>
  );
}
