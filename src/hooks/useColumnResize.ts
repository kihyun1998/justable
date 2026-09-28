import { useEffect, useRef, useState } from 'react';

/** Where a running border drag's pointer is, and the scroller it can scroll; `null` outside a grid. */
export interface ResizeDrag {
  clientX: number;
  clientY: number;
  scroller: HTMLElement | null;
}

/**
 * A column-border drag: mousedown arms it, `document` mousemove and the scroller's scroll report the
 * width, mouseup ends it. Not HTML5 drag, deliberately: `docs/map/territory/column-resize.md`.
 */
export function useColumnResize<K extends string>(
  onResize: (key: K, px: number) => void,
  /** Each move of a running drag, then `null` when it ends. */
  onDrag?: (drag: ResizeDrag | null) => void,
) {
  /** The border being dragged, for display only. */
  const [resizing, setResizing] = useState<K | null>(null);
  /** Ends the running drag; `null` while none runs. */
  const detach = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      detach.current?.();
      detach.current = null;
    },
    [],
  );

  /** `scale` is screen px per table px, for a scaled copy of the table. */
  const begin = (
    key: K,
    startWidth: number,
    startX: number,
    scale = 1,
    scroller: HTMLElement | null = null,
  ) => {
    detach.current?.();
    setResizing(key);
    const startScroll = scroller?.scrollLeft ?? 0;
    let x = startX;
    let scrolled = 0;
    // Only the pointer is divided by the scale: `docs/map/territory/column-resize.md`.
    const report = () => onResize(key, startWidth + (x - startX) / scale + scrolled);
    // Read from the element, not only on its event, which arrives a frame late:
    // `docs/map/territory/column-resize.md`.
    const readScroll = () => {
      scrolled = (scroller?.scrollLeft ?? 0) - startScroll;
    };
    const onMove = (ev: MouseEvent) => {
      x = ev.clientX;
      readScroll();
      report();
      onDrag?.({ clientX: ev.clientX, clientY: ev.clientY, scroller });
    };
    const onScroll = () => {
      const before = scrolled;
      readScroll();
      if (scrolled !== before) report();
    };
    const stop = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      scroller?.removeEventListener('scroll', onScroll);
      detach.current = null;
      onDrag?.(null);
    };
    const onUp = () => {
      onScroll();
      stop();
      setResizing(null);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    scroller?.addEventListener('scroll', onScroll);
    detach.current = stop;
  };

  return { resizing, begin };
}
