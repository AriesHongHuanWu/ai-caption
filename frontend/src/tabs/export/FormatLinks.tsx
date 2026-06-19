import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import {
  AlignLeft,
  Type as TypeIcon,
  Captions,
  Subtitles,
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
  /** Video → Subtitles mode: lead with SRT/VTT, de-emphasize LRC/ASS. */
  subtitleMode?: boolean;
}

/** Broad family of a format — drives subtitle-mode ordering + emphasis. */
type FormatFamily = 'subtitle' | 'lyric' | 'data';

interface LinkDef {
  id: string;
  name: string;
  ext: string;
  blurbKey: string;
  icon: LucideIcon;
  fmt: ExportFormat;
  level: ExportLevel;
  family: FormatFamily;
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
    family: 'lyric',
  },
  {
    id: 'lrc-word',
    name: 'LRC',
    ext: '.lrc',
    blurbKey: 'export.fmtLrcWord',
    icon: TypeIcon,
    fmt: 'lrc',
    level: 'word',
    family: 'lyric',
  },
  {
    id: 'srt',
    name: 'SRT',
    ext: '.srt',
    blurbKey: 'export.fmtSrt',
    icon: Captions,
    fmt: 'srt',
    level: 'line',
    family: 'subtitle',
  },
  {
    id: 'webvtt',
    name: 'WebVTT',
    ext: '.vtt',
    blurbKey: 'export.fmtWebVtt',
    icon: Subtitles,
    fmt: 'webvtt',
    level: 'line',
    family: 'subtitle',
  },
  {
    id: 'ass',
    name: 'ASS',
    ext: '.ass',
    blurbKey: 'export.fmtAss',
    icon: Sparkles,
    fmt: 'ass',
    level: 'word',
    family: 'lyric',
  },
  {
    id: 'json',
    name: 'JSON',
    ext: '.json',
    blurbKey: 'export.fmtJson',
    icon: Braces,
    fmt: 'json',
    level: 'word',
    family: 'data',
  },
];

function sameChoice(l: LinkDef, v: FormatChoice): boolean {
  return l.fmt === v.fmt && l.level === v.level;
}

/** Order for subtitle (video) mode: subtitle formats first, then lyric, then data. */
const FAMILY_ORDER: Record<FormatFamily, number> = { subtitle: 0, lyric: 1, data: 2 };

/** LRC line/word · SRT · WebVTT · ASS · JSON selector — a vertical list of typeset links. */
export function FormatLinks({ value, onChange, subtitleMode = false }: FormatLinksProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);

  // In subtitle mode, surface SRT/WebVTT at the top and push lyric/karaoke
  // formats down (and visually quieten them). Stable sort preserves the
  // authored order within each family.
  const links = subtitleMode
    ? LINKS.map((l, i) => ({ l, i }))
        .sort((a, b) => FAMILY_ORDER[a.l.family] - FAMILY_ORDER[b.l.family] || a.i - b.i)
        .map((x) => x.l)
    : LINKS;

  const activeIndex = Math.max(
    0,
    links.findIndex((l) => sameChoice(l, value)),
  );

  const focusIndex = (i: number) => {
    const clamped = (i + links.length) % links.length;
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
      focusIndex(links.length - 1);
    }
  };

  return (
    <div
      className="al-formatlinks"
      role="radiogroup"
      aria-label={t('export.fmtAriaLabel')}
      ref={listRef}
    >
      {links.map((l, i) => {
        const active = sameChoice(l, value);
        const Icon = l.icon;
        // De-emphasize lyric/karaoke formats in subtitle mode (still usable).
        const muted = subtitleMode && l.family === 'lyric' && !active;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            className={`al-formatlink ${active ? 'al-formatlink--active' : ''}${
              muted ? ' al-formatlink--muted' : ''
            }`}
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
