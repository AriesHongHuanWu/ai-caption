import { Minus, Plus, Check } from 'lucide-react';
import { Badge, Field, HairlineRule, IconButton, TapeCounter } from '../../components/primitives';
import { formatDuration, nudge } from '../../lib/timecode';
import { isLowConfidence } from './ConfidenceMark';
import { WaveformStrip } from './WaveformStrip';
import type { Word } from '../../api/types';
import type { WordRef } from '../../state/useResultStore';
import type { PeakData } from '../../lib/waveform';
import type { Onset } from '../../lib/onset';
import { useT } from '../../i18n';

export interface WordInspectorProps {
  word: Word;
  wordRef: WordRef;
  onText: (ref: WordRef, text: string) => void;
  onStart: (ref: WordRef, start: number) => void;
  onEnd: (ref: WordRef, end: number) => void;
  onConfirm: (ref: WordRef) => void;
  /** Decoded peaks for the hairline waveform slice (optional/offline-safe). */
  peaks?: PeakData | null;
  /** Onsets for magnetize-on-drag. */
  onsets?: Onset[];
  /** Playhead position for the slice playhead. */
  currentTime?: number;
}

/**
 * Summonable popover body: inline text edit, start/dur tape counters, ±10 ms
 * nudge, and boundary handles over a hairline waveform slice that magnetize
 * to the nearest vocal onset on drag. Adjacent-word boundaries follow in the
 * store so retiming never opens a gap.
 */
export function WordInspector({
  word,
  wordRef,
  onText,
  onStart,
  onEnd,
  onConfirm,
  peaks = null,
  onsets,
  currentTime = 0,
}: WordInspectorProps) {
  const t = useT();
  const low = isLowConfidence(word);
  const dur = Math.max(0, word.end - word.start);

  // A little padding around the word so the boundaries have room to drag.
  const pad = Math.max(0.25, dur * 0.6);
  const winStart = Math.max(0, word.start - pad);
  const winEnd = word.end + pad;

  return (
    <div className="al-inspector">
      <div className="al-inspector__row al-inspector__row--between">
        <span className="al-inspector__title">{t('editor.inspector.title')}</span>
        {low ? (
          <Badge tone="amber" dot>
            {t('editor.inspector.lowConfidence')} {(word.prob * 100).toFixed(0)}%
          </Badge>
        ) : (
          <Badge tone="green">{(word.prob * 100).toFixed(0)}%</Badge>
        )}
      </div>

      <Field
        value={word.word}
        onChange={(e) => onText(wordRef, e.target.value)}
        className="al-inspector__text"
        spellCheck={false}
        autoFocus
        aria-label={t('editor.inspector.wordTextAriaLabel')}
      />

      {/* hairline waveform slice with draggable, onset-magnetizing handles */}
      <div className="al-inspector__wave">
        <WaveformStrip
          peaks={peaks}
          currentTime={currentTime}
          duration={winEnd}
          height={56}
          windowStart={winStart}
          windowEnd={winEnd}
          onsets={onsets}
          onSeek={() => {
            /* slice is for retiming, not seeking */
          }}
          markers={[
            { id: 'start', time: word.start, onChange: (t) => onStart(wordRef, t) },
            { id: 'end', time: word.end, onChange: (t) => onEnd(wordRef, t) },
          ]}
        />
      </div>

      <HairlineRule />

      {/* START */}
      <div className="al-inspector__row al-inspector__row--between">
        <TapeCounter label="START" value={word.start} onCommit={(s) => onStart(wordRef, s)} />
        <div className="al-inspector__row">
          <IconButton
            label={t('editor.inspector.startMinus')}
            size="sm"
            icon={<Minus size={14} />}
            onClick={() => onStart(wordRef, nudge(word.start, -1))}
          />
          <IconButton
            label={t('editor.inspector.startPlus')}
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => onStart(wordRef, nudge(word.start, 1))}
          />
        </div>
      </div>

      {/* END */}
      <div className="al-inspector__row al-inspector__row--between">
        <TapeCounter label="END" value={word.end} onCommit={(s) => onEnd(wordRef, s)} />
        <div className="al-inspector__row">
          <IconButton
            label={t('editor.inspector.endMinus')}
            size="sm"
            icon={<Minus size={14} />}
            onClick={() => onEnd(wordRef, nudge(word.end, -1))}
          />
          <IconButton
            label={t('editor.inspector.endPlus')}
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => onEnd(wordRef, nudge(word.end, 1))}
          />
        </div>
      </div>

      <div className="al-inspector__row al-inspector__row--between">
        <span className="al-inspector__dur-label">DUR</span>
        <Badge>{formatDuration(dur)}</Badge>
      </div>

      <div className="al-inspector__hint">
        {t('editor.inspector.dragHint')}
      </div>

      {low && (
        <>
          <HairlineRule />
          <button
            type="button"
            className="al-btn al-btn--sm al-inspector__confirm"
            onClick={() => onConfirm(wordRef)}
          >
            <Check size={14} /> {t('editor.inspector.confirmWord')}
          </button>
        </>
      )}
    </div>
  );
}
