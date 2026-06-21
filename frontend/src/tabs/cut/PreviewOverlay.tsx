/* ──────────────────────────────────────────────────────────────────
   PreviewOverlay — direct on-canvas manipulation of the selected clip.
   A selection box with a draggable body (move), four corner handles
   (scale) and a top handle (rotate), positioned over the preview canvas
   each frame from getSelectedBox(). Edits are coalesced into ONE undo
   step per drag via the store's gesture API. Locked tracks are skipped;
   Esc cancels a drag; double-click the rotate grip resets rotation.
   ────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef } from 'react';
import { useEditor } from './useEditor';
import type { SelBox } from './usePlayback';
import type { Clip } from './types';

interface Props {
  getBox: () => SelBox | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

type Mode = 'move' | 'scale' | 'rotate';
interface Drag { mode: Mode; id: string; sx: number; sy: number; startX: number; startY: number; x0: number; y0: number; s0: number; r0: number; cxS: number; cyS: number; d0: number; a0: number; }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function curSel(): { clip: Clip; locked: boolean } | null {
  const st = useEditor.getState();
  if (!st.selectedId) return null;
  for (const tr of st.doc.tracks) { const c = tr.clips.find((x) => x.id === st.selectedId); if (c) return { clip: c, locked: tr.locked }; }
  return null;
}

export function PreviewOverlay({ getBox, canvasRef }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const lastBox = useRef<SelBox | null>(null);
  const escRef = useRef<(e: KeyboardEvent) => void>(() => {});

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const box = getBox();
      lastBox.current = box;
      const el = boxRef.current; const cv = canvasRef.current;
      if (el && cv) {
        if (!box || !box.visible) { el.style.display = 'none'; }
        else {
          const sx = cv.clientWidth / Math.max(1, cv.width);
          const sy = cv.clientHeight / Math.max(1, cv.height);
          const w = box.hw * 2 * sx; const h = box.hh * 2 * sy;
          el.style.display = 'block';
          el.style.width = `${Math.max(12, w)}px`;
          el.style.height = `${Math.max(12, h)}px`;
          el.style.transform = `translate(${box.cx * sx - w / 2}px, ${box.cy * sy - h / 2}px) rotate(${box.rot}deg)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getBox, canvasRef]);

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const live = useEditor.getState().liveUpdateClip;
    if (d.mode === 'move') {
      live(d.id, { x: d.x0 + (e.clientX - d.startX) / d.sx, y: d.y0 + (e.clientY - d.startY) / d.sy });
    } else if (d.mode === 'scale') {
      const d1 = Math.hypot(e.clientX - d.cxS, e.clientY - d.cyS);
      live(d.id, { scale: clamp(d.s0 * (d1 / Math.max(1, d.d0)), 0.05, 10) });
    } else {
      const a1 = (Math.atan2(e.clientY - d.cyS, e.clientX - d.cxS) * 180) / Math.PI;
      let r = d.r0 + (a1 - d.a0);
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      live(d.id, { rotation: Math.round(r) });
    }
  }, []);

  const end = useCallback(() => {
    if (drag.current) useEditor.getState().endGesture();
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('keydown', escRef.current);
  }, [onMove]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('keydown', escRef.current);
  }, [onMove, end]);

  const begin = (e: React.PointerEvent, mode: Mode) => {
    e.stopPropagation();
    e.preventDefault();
    const sel = curSel(); const cv = canvasRef.current; const box = lastBox.current;
    if (!sel || sel.locked || !cv || !box) return; // respect track lock
    const clip = sel.clip;
    const rect = cv.getBoundingClientRect();
    const sx = cv.clientWidth / Math.max(1, cv.width);
    const sy = cv.clientHeight / Math.max(1, cv.height);
    const cxS = rect.left + box.cx * sx;
    const cyS = rect.top + box.cy * sy;
    drag.current = {
      mode, id: clip.id, sx, sy, startX: e.clientX, startY: e.clientY,
      x0: clip.x, y0: clip.y, s0: clip.scale, r0: clip.rotation, cxS, cyS,
      d0: Math.hypot(e.clientX - cxS, e.clientY - cyS),
      a0: (Math.atan2(e.clientY - cyS, e.clientX - cxS) * 180) / Math.PI,
    };
    useEditor.getState().beginGesture();
    escRef.current = (ke: KeyboardEvent) => { if (ke.key === 'Escape') { useEditor.getState().cancelGesture(); end(); } };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('keydown', escRef.current);
  };

  const resetRotation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const sel = curSel();
    if (sel && !sel.locked) useEditor.getState().updateClip(sel.clip.id, { rotation: 0 });
  };

  return (
    <div className="al-cut__ovlwrap">
      <div ref={boxRef} className="al-cut__ovl" style={{ display: 'none' }} onPointerDown={(e) => begin(e, 'move')}>
        <span className="al-cut__rot" onPointerDown={(e) => begin(e, 'rotate')} onDoubleClick={resetRotation} title="rotate (double-click = reset)" />
        <span className="al-cut__h al-cut__h--tl" onPointerDown={(e) => begin(e, 'scale')} />
        <span className="al-cut__h al-cut__h--tr" onPointerDown={(e) => begin(e, 'scale')} />
        <span className="al-cut__h al-cut__h--bl" onPointerDown={(e) => begin(e, 'scale')} />
        <span className="al-cut__h al-cut__h--br" onPointerDown={(e) => begin(e, 'scale')} />
      </div>
    </div>
  );
}
