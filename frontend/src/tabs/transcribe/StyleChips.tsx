import type { ReactNode } from 'react';
import {
  Music2,
  Heart,
  Guitar,
  Mic,
  Radio,
  Trees,
  Disc3,
  Piano,
  Baby,
  Tag,
} from 'lucide-react';
import { Pill, TextAreaField } from '../../components/primitives';
import { useT } from '../../i18n';
import type { StyleOption } from '../../api/types';

export interface StyleChipsProps {
  styles: StyleOption[];
  selected: string[];
  onToggle: (key: string) => void;
  contentHint: string;
  onContentHint: (text: string) => void;
}

/** Quiet icon-per-genre map; unknown keys fall back to a generic tag. */
const STYLE_ICON: Record<string, ReactNode> = {
  pop: <Music2 size={12} strokeWidth={2} />,
  ballad: <Heart size={12} strokeWidth={2} />,
  rock: <Guitar size={12} strokeWidth={2} />,
  rap: <Mic size={12} strokeWidth={2} />,
  electronic: <Radio size={12} strokeWidth={2} />,
  folk: <Trees size={12} strokeWidth={2} />,
  rnb: <Disc3 size={12} strokeWidth={2} />,
  jazz: <Disc3 size={12} strokeWidth={2} />,
  classical: <Piano size={12} strokeWidth={2} />,
  kids: <Baby size={12} strokeWidth={2} />,
};

function iconFor(key: string): ReactNode {
  return STYLE_ICON[key] ?? <Tag size={12} strokeWidth={2} />;
}

// Genre keys we ship a localized label for. Unknown server keys fall back to
// the raw meta label so a custom backend genre still renders something.
const KNOWN_STYLE_KEYS = new Set([
  'pop',
  'ballad',
  'rock',
  'rap',
  'electronic',
  'folk',
  'rnb',
  'jazz',
  'classical',
  'kids',
]);

/** Genre pill chips + freeform content hint → styleKeys + referenceContent. */
export function StyleChips({
  styles,
  selected,
  onToggle,
  contentHint,
  onContentHint,
}: StyleChipsProps) {
  const t = useT();

  return (
    <div className="al-stylechips">
      <div className="al-stylechips__label">
        {t('transcribe.style.label')}
        {selected.length > 0 && (
          <span className="al-stylechips__count"> · {selected.length}</span>
        )}
      </div>
      <div className="al-chips">
        {styles.map((s) => (
          <Pill
            key={s.key}
            active={selected.includes(s.key)}
            onClick={() => onToggle(s.key)}
            icon={iconFor(s.key)}
          >
            {KNOWN_STYLE_KEYS.has(s.key) ? t(`transcribe.style.${s.key}`) : s.label}
          </Pill>
        ))}
      </div>

      <TextAreaField
        label={t('transcribe.style.contentHintLabel')}
        value={contentHint}
        onChange={(e) => onContentHint(e.target.value)}
        placeholder={t('transcribe.style.contentHintPlaceholder')}
        hint={t('transcribe.style.contentHintHint')}
        style={{ minHeight: 68 }}
        spellCheck={false}
      />
    </div>
  );
}
