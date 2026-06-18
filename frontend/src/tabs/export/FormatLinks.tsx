import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  AlignLeft,
  Type as TypeIcon,
  Captions,
  Sparkles,
  Braces,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ExportFormat, ExportLevel } from '../../api/types';
import { useT } from '../../i18n';

export interface FormatChoice {
  fmt: ExportFormat;
  level: ExportLevel;
}

export interface FormatLinksProps {
  value: FormatChoice;
  onChange: (choice: FormatChoice) => void;
}

interface LinkDef {
  id: string;
  name: string;
  ext: string;
  blurbKey: string;
  icon: LucideIcon;
  fmt: ExportFormat;
  level: ExportLevel;
}

const LINKS: LinkDef[] = [
  {
    id: 'lrc-line',
    name: 'LRC',
    ext: '.lrc',
    blurbKey: 'export.fmtLrcLine',
    icon: AlignLeft,
    fmt: 'lrc',
    level: 'line',
  },
  {
    id: 'lrc-word',
    name: 'LRC',
    ext: '.lrc',
    blurbKey: 'export.fmtLrcWord',
    icon: TypeIcon,
    fmt: 'lrc',
    level: 'word',
  },
  {
    id: 'srt',
    name: 'SRT',
    ext: '.srt',
    blurbKey: 'export.fmtSrt',
    icon: Captions,
    fmt: 'srt',
    level: 'line',
  },
  {
    id: 'ass',
    name: 'ASS',
    ext: '.ass',
    blurbKey: 'export.fmtAss',
    icon: Sparkles,
    fmt: 'ass',
    level: 'word',
  },
  {
    id: 'json',
    name: 'JSON',
    ext: '.json',
    blurbKey: 'export.fmtJson',
    icon: Braces,
    fmt: 'json',
    level: 'word',
  },
];

function sameChoice(l: LinkDef, v: FormatChoice): boolean {
  return l.fmt === v.fmt && l.level === v.level;
}

/** LRC line/word · SRT · ASS · JSON selector — a vertical list of typeset links. */
export function FormatLinks({ value, onChange }: FormatLinksProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(
    0,
    LINKS.findIndex((l) => sameChoice(l, value)),
  );

  const focusIndex = (i: number) => {
    const clamped = (i + LINKS.length) % LINKS.length;
    const node = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '.al-formatlink',
    )[clamped];
    node?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex(index + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      focusIndex(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusIndex(LINKS.length - 1);
    }
  };

  return (
    <div
      className="al-formatlinks"
      role="radiogroup"
      aria-label={t('export.fmtAriaLabel')}
      ref={listRef}
    >
      {LINKS.map((l, i) => {
        const active = sameChoice(l, value);
        const Icon = l.icon;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            className={`al-formatlink ${active ? 'al-formatlink--active' : ''}`}
            onClick={() => onChange({ fmt: l.fmt, level: l.level })}
            onKeyDown={(e) => onKeyDown(e, i)}
            aria-checked={active}
            tabIndex={i === activeIndex ? 0 : -1}
          >
            <span className="al-formatlink__edge" aria-hidden="true" />
            <span className="al-formatlink__glyph" aria-hidden="true">
              <Icon size={17} strokeWidth={1.5} />
            </span>
            <span className="al-formatlink__body">
              <span className="al-formatlink__name">
                {l.name}
                <span className="al-formatlink__ext">{l.ext}</span>
              </span>
              <span className="al-formatlink__blurb">{t(l.blurbKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
