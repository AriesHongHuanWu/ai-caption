/* ──────────────────────────────────────────────────────────────────
   useShortcuts — global keyboard shortcuts for the editor, ignored while
   typing in a field. CapCut/OpenCut-style: Space play, S split, Del
   delete, ⌘Z undo, copy/paste/dup, arrows nudge, +/- zoom, ? help.
   ────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react';

export interface ShortcutHandlers {
  togglePlay: () => void;
  split: () => void;
  del: () => void;
  undo: () => void;
  redo: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  nudge: (dir: number, big: boolean) => void;
  zoom: (dir: number) => void;
  help: () => void;
}

const isField = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
};

export function useShortcuts(h: ShortcutHandlers, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isField(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); return; }
      if (mod && (k === 'y' || k === 'Y')) { e.preventDefault(); h.redo(); return; }
      if (mod && (k === 'c' || k === 'C')) { e.preventDefault(); h.copy(); return; }
      if (mod && (k === 'v' || k === 'V')) { e.preventDefault(); h.paste(); return; }
      if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); h.duplicate(); return; }
      if (mod) return;
      switch (k) {
        case ' ': e.preventDefault(); h.togglePlay(); break;
        case 's': case 'S': e.preventDefault(); h.split(); break;
        case 'Delete': case 'Backspace': e.preventDefault(); h.del(); break;
        case 'ArrowLeft': e.preventDefault(); h.nudge(-1, e.shiftKey); break;
        case 'ArrowRight': e.preventDefault(); h.nudge(1, e.shiftKey); break;
        case '=': case '+': e.preventDefault(); h.zoom(1); break;
        case '-': case '_': e.preventDefault(); h.zoom(-1); break;
        case '?': e.preventDefault(); h.help(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [h, enabled]);
}
