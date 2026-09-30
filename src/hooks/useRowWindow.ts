/**
 * The grid's row window: the scroller's offset and box, the range of rows drawn from them, where a
 * drawn row sits, the focused row brought back into view, and the page size written to the keyboard.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

import { screenScale, scrollToReveal, visibleRange } from '../lib/rowWindow.js';
import type { RowWindow } from '../types.js';
import type { TableKeyboardLink } from './useTableKeyboard.js';

/** The measured viewport, in layout px. */
export interface RowBox {
  viewportHeight: number;
  rowHeight: number;
}

export interface RowWindowInput {
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The element whose first child is sampled as a row. */
  canvasRef: RefObject<HTMLDivElement | null>;
  /** A child of the canvas that is never sampled as a row. */
  notARowRef: RefObject<HTMLDivElement | null>;
  total: number;
  focus: number | null;
  rowHeightRem: number;
  keyboard?: TableKeyboardLink;
}

export interface RowWindowState {
  /** `null` until the viewport has a height. */
  box: RowBox | null;
  /** The data-row indices drawn. */
  range: RowWindow;
  /** Absolute placement of data row `index`; `undefined` before measurement, when rows flow. */
  place: (index: number) => CSSProperties | undefined;
  /** Takes the scroller's vertical offset. */
  onScroll: (scrollTop: number) => void;
  /** Measures the box now; reads only refs. */
  measure: () => void;
}

export function useRowWindow({
  scrollerRef,
  canvasRef,
  notARowRef,
  total,
  focus,
  rowHeightRem,
  keyboard,
}: RowWindowInput): RowWindowState {
  // Read through a ref by the observer attached once: `docs/map/territory/row-windowing.md`.
  const rowHeightRemRef = useRef(rowHeightRem);
  rowHeightRemRef.current = rowHeightRem;

  // Scroll and size are separate state, deliberately: `docs/map/territory/row-windowing.md`.
  const [scrollTop, setScrollTop] = useState(0);
  const [box, setBox] = useState<RowBox | null>(null);

  const measure = () => {
    const el = scrollerRef.current;
    // A zero viewport is no measurement: `docs/map/invariant/zero-is-no-measurement.md`.
    if (!el || el.clientHeight <= 0) return;
    const first = canvasRef.current?.firstElementChild;
    const row = first === notARowRef.current ? null : first;
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // The row is measured on screen and converted to layout px:
    // `docs/map/invariant/lengths-are-layout-px.md`.
    const scale = screenScale(el.getBoundingClientRect().height, el.offsetHeight);
    const next = {
      viewportHeight: el.clientHeight,
      rowHeight: (row?.getBoundingClientRect().height ?? 0) / scale || rowHeightRemRef.current * rootPx,
    };
    setBox((prev) =>
      prev && prev.viewportHeight === next.viewportHeight && prev.rowHeight === next.rowHeight
        ? prev
        : next,
    );
  };

  useLayoutEffect(measure);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // Attached once, deliberately: `docs/map/territory/row-windowing.md`.
  }, []);

  // Bring the focused row back into view.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !box || focus === null) return;
    // Reads the offset from the element, not from state, deliberately:
    // `docs/map/territory/row-windowing.md`.
    const next = scrollToReveal(focus, { scrollTop: el.scrollTop, ...box });
    if (next !== null) el.scrollTop = next;
  }, [focus, box]);

  useEffect(() => {
    if (box && keyboard) keyboard.rowsPerPage = Math.floor(box.viewportHeight / box.rowHeight);
  }, [box, keyboard]);

  return {
    box,
    // No box is no measurement, which `visibleRange` answers for itself:
    // `docs/map/invariant/zero-is-no-measurement.md`.
    range: visibleRange({ scrollTop, viewportHeight: 0, rowHeight: 0, ...box, total }),
    // `right: 0` as well as `left` is deliberate:
    // `docs/map/invariant/drawn-columns-are-tracks-are-cells.md`.
    place: (index) =>
      box ? { position: 'absolute', top: index * box.rowHeight, left: 0, right: 0 } : undefined,
    onScroll: setScrollTop,
    measure,
  };
}
