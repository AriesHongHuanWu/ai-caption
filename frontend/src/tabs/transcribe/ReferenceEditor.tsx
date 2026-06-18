import { useMemo } from 'react';
import { AlignLeft, Crosshair, Info, Lightbulb } from 'lucide-react';
import { TextAreaField } from '../../components/primitives';
import { useT } from '../../i18n';

export interface ReferenceEditorProps {
  value: string;
  onChange: (text: string) => void;
  /** align = full lyrics expected; biasing = partial is fine. */
  mode: 'biasing' | 'align';
}

/** Threshold: if user pastes this many lines under Biasing, nudge them toward Forced-Align. */
const FULL_LYRICS_LINE_THRESHOLD = 8;

/** Full-width serif reference-lyrics editor (line breaks preserved). */
export function ReferenceEditor({ value, onChange, mode }: ReferenceEditorProps) {
  const t = useT();
  const align = mode === 'align';

  const { lines, chars } = useMemo(() => {
    const trimmed = value.trim();
    return {
      lines: trimmed === '' ? 0 : value.split('\n').filter((l) => l.trim()).length,
      chars: trimmed.length,
    };
  }, [value]);

  // Nudge hint: if under Biasing the user pastes many lines, it probably looks like full lyrics.
  const showFullLyricsNudge = !align && lines >= FULL_LYRICS_LINE_THRESHOLD;

  const placeholder = align
    ? t('transcribe.ref.placeholderAlign')
    : t('transcribe.ref.placeholderBiasing');

  return (
    <div className="al-refeditor">
      <div className="al-refeditor__head">
        <span className="al-refeditor__which">
          {align ? (
            <>
              <Crosshair size={12} strokeWidth={2} /> {t('transcribe.ref.fullLyrics')}
            </>
          ) : (
            <>
              <AlignLeft size={12} strokeWidth={2} /> {t('transcribe.ref.fragments')}
            </>
          )}
        </span>
        <span className="al-refeditor__count">
          {lines} {t('transcribe.ref.linesChars')} · {chars} {t('transcribe.ref.chars')}
        </span>
      </div>

      <TextAreaField
        serif
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        hint={align ? t('transcribe.ref.hintAlign') : t('transcribe.ref.hintBiasing')}
        style={{ minHeight: align ? 184 : 148, fontSize: 'var(--al-text-lg)', lineHeight: 1.55 }}
        spellCheck={false}
        aria-label={align ? t('transcribe.ref.ariaAlign') : t('transcribe.ref.ariaFragments')}
      />

      {/* Forced-align helper line — describes what the input does in plain language */}
      {align && (
        <div className="al-refeditor__helper" role="note">
          <Lightbulb size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t('transcribe.ref.alignHelperLine')}</span>
        </div>
      )}

      {showFullLyricsNudge && (
        <div className="al-refeditor__nudge" role="status">
          <Info size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{t('transcribe.mode.biasing.fullLyricsHint')}</span>
        </div>
      )}
    </div>
  );
}
