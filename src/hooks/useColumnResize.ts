import { useEffect, useRef, useState } from 'react';

/**
 * A column-border drag: mousedown arms it, `document` mousemove reports the width, mouseup ends it.
 * Pointer events, not HTML5 drag — Tauri's drag-drop handling swallows the latter.
 */
export function useColumnResize<K extends string>(onResize: (key: K, px: number) => void) {
  /** The border being dragged, for display only. */
  const [resizing, setResizing] = useState<K | null>(null);
  /** Removes the running drag's `document` listeners; `null` while none runs. */
  const detach = useRef<(() => void) | null>(null);

  // A drag outliving its component would keep writing widths.
  useEffect(
    () => () => {
      detach.current?.();
      detach.current = null;
    },
    [],
  );

  /** `scale` is screen px per table px, for a scaled copy of the table. */
  const begin = (key: K, startWidth: number, startX: number, scale = 1) => {
    detach.current?.();
    setResizing(key);
    const onMove = (ev: MouseEvent) => onResize(key, startWidth + (ev.clientX - startX) / scale);
    const stop = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      detach.current = null;
    };
    const onUp = () => {
      stop();
      setResizing(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    detach.current = stop;
  };

  return { resizing, begin };
}
