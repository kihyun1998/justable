import { useState } from 'react';

import { useDrag } from './useDrag.js';

/** Where a running border drag's pointer is, and the scroller it can scroll; `null` outside a grid. */
export interface ResizeDrag {
  clientX: number;
  clientY: number;
  scroller: HTMLElement | null;
}

/**
 * A column-border drag: mousedown arms it, `document` mousemove and the scroller's scroll report the
 * width, the pressing button's mouseup ends it. Not HTML5 drag, deliberately: `docs/map/territory/column-resize.md`.
 */
export function useColumnResize<K extends string>(
  onResize: (key: K, px: number) => void,
  /** Each move of a running drag, then `null` when it ends. */
  onDrag?: (drag: ResizeDrag | null) => void,
) {
  /** The border being dragged, for display only. */
  const [resizing, setResizing] = useState<K | null>(null);
  const drag = useDrag();

  /** `scale` is screen px per table px, for a scaled copy of the table. */
  const begin = (
    key: K,
    startWidth: number,
    startX: number,
    scale = 1,
    scroller: HTMLElement | null = null,
    /** Holds the scroller's content at its widest for the drag, then lets it go. */
    holdWidth?: (on: boolean) => void,
    /** The button that pressed; given, only it ends the drag. Without it, any mouseup does. */
    button?: number,
  ) => {
    drag.begin(button, scroller, () => {
      let seen = scroller?.scrollLeft ?? 0;
      let x = startX;
      let scrolled = 0;
      // Only the pointer is divided by the scale: `docs/map/territory/column-resize.md`.
      const report = () => onResize(key, startWidth + (x - startX) / scale + scrolled);
      // Read from the element, not only on its event, which arrives a frame late:
      // `docs/map/territory/column-resize.md`.
      const readScroll = () => {
        holdWidth?.(true);
        if (!scroller) return;
        scrolled += scroller.scrollLeft - seen;
        seen = scroller.scrollLeft;
      };
      const onScroll = () => {
        const before = scrolled;
        readScroll();
        if (scrolled !== before) report();
      };
      return {
        move: (ev) => {
          x = ev.clientX;
          readScroll();
          report();
          onDrag?.({ clientX: ev.clientX, clientY: ev.clientY, scroller });
        },
        scroll: onScroll,
        release: () => {
          onScroll();
          setResizing(null);
        },
        ended: () => {
          holdWidth?.(false);
          onDrag?.(null);
        },
      };
    });
    setResizing(key);
    holdWidth?.(true);
  };

  return { resizing, begin };
}
