/* ──────────────────────────────────────────────────────────────────
   CueList — a scrollable list of subtitle cues for the video flow.

   Each row = one segment: a mono timecode range + the caption text.
   Clicking a row seeks the shared transport to that cue's start; the
   row containing the playhead is highlighted in gold. Shown after a
   video job completes.
   ────────────────────────────────────────────────────────────────── */

import { useMemo } from 'react';
import { Captions } from 'lucide-react';
import type { Result } from '../../api/types';
import { useAudio } from '../../state/useAudio';
import { formatClock } from '../../lib/timecode';
import { useT } from '../../i18n';

export interface CueListProps {
  result: Result;
}

export function CueList({ result }: CueListProps) {
  const t = useT();
  const currentTime = useAudio((s) => s.currentTime);
  const seek = useAudio((s) => s.seek);
  const play = useAudio((s) => s.play);

  const cues = useMemo(
    () => result.segments.filter((s) => s.text.trim().length > 0),
    [result.segments],
  );

  const activeId = useMemo(() => {
    const hit = cues.find((s) => currentTime >= s.start && currentTime < s.end);
    return hit?.id ?? null;
  }, [cues, currentTime]);

  if (cues.length === 0) {
    return (
      <div className="al-cuelist__empty">{t('video.cues.empty')}</div>
    );
  }

  return (
    <div className="al-cuelist">
      <div className="al-cuelist__head">
        <span className="al-cuelist__title">
          <Captions size={13} strokeWidth={1.6} /> {t('video.cues.title')}
        </span>
        <span className="al-cuelist__count">
          {t('video.cues.count', { count: cues.length })}
        </span>
      </div>

      <ul className="al-cuelist__rows" aria-label={t('video.cues.ariaLabel')}>
        {cues.map((seg) => {
          const active = seg.id === activeId;
          return (
            <li key={seg.id}>
              <button
                type="button"
                className={`al-cue${active ? ' al-cue--active' : ''}`}
                onClick={() => {
                  seek(seg.start);
                  play();
                }}
                title={t('video.cues.seekTitle')}
              >
                <span className="al-cue__time">
                  {formatClock(seg.start)} – {formatClock(seg.end)}
                </span>
                <span className="al-cue__text">{seg.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
