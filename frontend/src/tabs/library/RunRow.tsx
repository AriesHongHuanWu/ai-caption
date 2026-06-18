import { useState, type KeyboardEvent } from 'react';
import { FileOutput, CopyPlus, Trash2, PenLine, Check, Scissors } from 'lucide-react';
import { Badge, IconButton } from '../../components/primitives';
import { formatClock } from '../../lib/timecode';
import type { RunRecord } from '../../state/useLibrary';
import { modeLabel, languageLabelT, formatRunDate, relativeRunDate } from './runMeta';
import { useT } from '../../i18n';

export interface RunRowProps {
  run: RunRecord;
  onOpen: (run: RunRecord) => void;
  onReExport: (run: RunRecord) => void;
  onDuplicate: (run: RunRecord) => void;
  onDelete: (id: string) => void;
  /** Marked when this run is a built-in sample (offline demo data). */
  sample?: boolean;
}

/**
 * RunRow — one quiet mono history row. Click (or Enter/Space) reopens the run
 * in the Editor; secondary actions re-export, duplicate the settings, or delete.
 * Shows which model + engine produced the run — a local-first trust signal.
 */
export function RunRow({ run, onOpen, onReExport, onDuplicate, onDelete, sample = false }: RunRowProps) {
  const t = useT();

  // Two-step delete so a stray click never destroys history.
  const [confirming, setConfirming] = useState(false);

  const open = () => {
    if (sample) return; // sample rows are illustrative only
    onOpen(run);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
    if (e.key === 'Escape' && confirming) setConfirming(false);
  };

  const wordCount = run.result.segments.reduce((n, s) => n + s.words.length, 0);
  const separated = run.result.meta.separated;

  const modeLbl = modeLabel(run.mode, t);
  const langLbl = languageLabelT(run.language, t);

  return (
    <div
      className={`al-runrow${sample ? ' al-runrow--sample' : ''}`}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={t('library.row.aria', { title: run.title, mode: modeLbl, lang: langLbl })}
    >
      {/* Title + sub-line (lang · words) */}
      <div className="al-runrow__name">
        <span className="al-runrow__title">{run.title}</span>
        <span className="al-runrow__sub">
          <span className="al-runrow__lang">{langLbl}</span>
          {wordCount > 0 && (
            <>
              <span className="al-runrow__dot" aria-hidden="true">
                ·
              </span>
              <span>{t('library.row.wordCount', { count: wordCount })}</span>
            </>
          )}
          {separated && (
            <>
              <span className="al-runrow__dot" aria-hidden="true">
                ·
              </span>
              <span
                className="al-runrow__sep"
                title={t('library.row.separated.title')}
              >
                <Scissors size={10} strokeWidth={2} /> {t('library.row.separated.label')}
              </span>
            </>
          )}
        </span>
      </div>

      {/* Mode — metadata, so neutral (gold is reserved for live/primary). */}
      <span className="al-runrow__mode">
        <Badge tone="neutral">{modeLbl}</Badge>
      </span>

      {/* Duration */}
      <span className="al-runrow__cell al-runrow__dur" title={t('library.row.durTitle')}>
        {formatClock(run.durationSec)}
      </span>

      {/* Which model + engine produced it — the trust signal. */}
      <span className="al-runrow__engine" title={t('library.row.engineTitle')}>
        <span className="al-runrow__model">{run.modelSize}</span>
        <span className="al-runrow__dot" aria-hidden="true">
          ·
        </span>
        <span>{run.engine}</span>
      </span>

      {/* Date */}
      <span
        className="al-runrow__cell al-runrow__date"
        title={relativeRunDate(run.createdAt, t)}
      >
        {formatRunDate(run.createdAt)}
      </span>

      {/* Status — done is the only state a stored run can be in. Green = done. */}
      <span className="al-runrow__status">
        {sample ? (
          <Badge tone="neutral">{t('library.row.statusSample')}</Badge>
        ) : (
          <Badge tone="green" dot>
            {t('library.row.statusDone')}
          </Badge>
        )}
      </span>

      {/* Secondary actions — revealed on hover/focus; never steal the row click. */}
      <span className="al-runrow__actions" onClick={(e) => e.stopPropagation()}>
        {confirming ? (
          <span className="al-runrow__confirm">
            <span className="al-runrow__confirm-q">{t('library.row.confirmQ')}</span>
            <IconButton
              label={t('library.row.confirmYes')}
              size="sm"
              icon={<Check size={14} />}
              className="al-runrow__confirm-yes"
              onClick={() => {
                setConfirming(false);
                onDelete(run.id);
              }}
            />
            <IconButton
              label={t('common.action.cancel')}
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={() => setConfirming(false)}
            />
          </span>
        ) : (
          <>
            <IconButton
              label={t('library.row.openEditor')}
              size="sm"
              icon={<PenLine size={14} />}
              onClick={open}
              disabled={sample}
            />
            <IconButton
              label={t('library.row.reExport')}
              size="sm"
              icon={<FileOutput size={14} />}
              onClick={() => onReExport(run)}
              disabled={sample}
            />
            <IconButton
              label={t('library.row.dupSettings')}
              size="sm"
              icon={<CopyPlus size={14} />}
              onClick={() => onDuplicate(run)}
            />
            <IconButton
              label={t('library.row.delete')}
              size="sm"
              icon={<Trash2 size={14} />}
              className="al-runrow__del"
              onClick={() => setConfirming(true)}
              disabled={sample}
            />
          </>
        )}
      </span>
    </div>
  );
}
