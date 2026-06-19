/* ──────────────────────────────────────────────────────────────────
   SubtitleOverlay — paints the currently-active caption over the video.

   Reads the result's segments and the shared currentTime; shows the one
   segment whose [start, end) contains the playhead. Styled as a clean,
   readable lower-third caption (paper ink on a soft scrim) — on-brand,
   never flashy.
   ────────────────────────────────────────────────────────────────── */

import { useMemo } from 'react';
import type { Result } from '../../api/types';
import { useT } from '../../i18n';

export interface SubtitleOverlayProps {
  result: Result;
  currentTime: number;
}

export function SubtitleOverlay({ result, currentTime }: SubtitleOverlayProps) {
  const t = useT();

  const active = useMemo(() => {
    return result.segments.find(
      (s) => currentTime >= s.start && currentTime < s.end,
    );
  }, [result.segments, currentTime]);

  if (!active || !active.text.trim()) return null;

  return (
    <div className="al-suboverlay" aria-live="polite" aria-label={t('video.overlay.ariaLabel')}>
      <span className="al-suboverlay__cue">{active.text}</span>
    </div>
  );
}
