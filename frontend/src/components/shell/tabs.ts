/* The LOCKED 5-tab IA (DESIGN.md section 4). Single source for nav + router. */
import type { LucideIcon } from 'lucide-react';
import {
  AudioLines,
  TextCursorInput,
  FileOutput,
  Library,
  SlidersHorizontal,
} from 'lucide-react';

export type TabKey = 'transcribe' | 'editor' | 'export' | 'library' | 'settings';

export interface TabDef {
  key: TabKey;
  /** i18n key for the tab label (resolved via t() at render). */
  labelKey: string;
  icon: LucideIcon;
}

export const TABS: TabDef[] = [
  { key: 'transcribe', labelKey: 'common.nav.transcribe', icon: AudioLines },
  { key: 'editor', labelKey: 'common.nav.editor', icon: TextCursorInput },
  { key: 'export', labelKey: 'common.nav.export', icon: FileOutput },
  { key: 'library', labelKey: 'common.nav.library', icon: Library },
  { key: 'settings', labelKey: 'common.nav.settings', icon: SlidersHorizontal },
];
