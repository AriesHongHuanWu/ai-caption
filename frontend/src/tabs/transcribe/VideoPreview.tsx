/* ──────────────────────────────────────────────────────────────────
   VideoPreview — a framed <video> for the "Video → Subtitles" mode.

   Plays the chosen file from a local object URL and stays in lock-step
   with the shared useAudio store (the same clock the timeline / sweep
   read), so seeking the cue list or the export scrubber moves this
   preview too. The SubtitleOverlay paints the active caption on top.

   The element is muted-but-controllable: useAudio owns its own hidden
   <audio> element as the transport's source of truth. To avoid two
   audio sources fighting, this <video> follows useAudio.currentTime /
   playing rather than driving them — it is a *preview surface*, not a
   second transport. (Its own audio track is muted.)
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useMemo, useRef } from 'react';
import { useAudio } from '../../state/useAudio';
import { useResultStore } from '../../state/useResultStore';
import { SubtitleOverlay } from './SubtitleOverlay';
import { useT } from '../../i18n';

export interface VideoPreviewProps {
  /** The chosen source file (video or audio). */
  file: File;
}

const DRIFT_TOLERANCE = 0.3; // seconds before we hard-resync the preview

export function VideoPreview({ file }: VideoPreviewProps) {
  const t = useT();
  const ref = useRef<HTMLVideoElement>(null);
  const currentTime = useAudio((s) => s.currentTime);
  const playing = useAudio((s) => s.playing);
  const seek = useAudio((s) => s.seek);
  const result = useResultStore((s) => s.result);

  // One object URL per file; revoked on change/unmount.
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // Follow the shared clock: keep playback running and resync on drift.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.abs(v.currentTime - currentTime) > DRIFT_TOLERANCE) {
      v.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing && v.paused) void v.play?.().catch(() => {});
    else if (!playing && !v.paused) v.pause?.();
  }, [playing]);

  return (
    <div className="al-vpreview" aria-label={t('video.preview.ariaLabel')}>
      <div className="al-vpreview__frame">
        <video
          ref={ref}
          className="al-vpreview__video"
          src={url}
          muted
          playsInline
          // Clicking the frame seeks via the shared transport so the timeline
          // stays the single source of truth.
          onClick={() => seek(currentTime)}
        />
        {result && (
          <SubtitleOverlay result={result} currentTime={currentTime} />
        )}
      </div>
    </div>
  );
}
