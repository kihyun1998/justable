/**
 * The grid's row window: the scroller's offset and box, the range of rows drawn from them, where a
 * drawn row sits, the focused row brought back into view, and the page size written to the keyboard.
 */
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';

import { canvasOffset, longScale, scrollToReveal, visibleRange } from '../lib/rowWindow.js';
import type { RowWindow } from '../types.js';
import type { TableKeyboardLink } from './useTableKeyboard.js';

/** The measured viewport, in layout px. */
export interface RowBox {
  viewportHeight: number;
  rowHeight: number;
  /** The canvas's offset in the scroller's content; leading rows push it down. */
  canvasTop: number;
}

export interface RowWindowInput {
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The element whose first child is sampled as a row, and on which the data rows are placed. */
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

  // The offset is a ref and the box is state, deliberately: `docs/map/territory/row-windowing.md`.
  const scrollTopRef = useRef(0);
  const [box, setBox] = useState<RowBox | null>(null);
  const boxRef = useRef(box);
  const totalRef = useRef(total);
  totalRef.current = total;
  /** Renders the grid again; called only when the drawn window moves. */
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  // No box is no measurement, which `visibleRange` answers for itself:
  // `docs/map/invariant/zero-is-no-measurement.md`.
  const windowAt = (scrollTop: number, at: RowBox | null, rows: number) =>
    visibleRange({ scrollTop, viewportHeight: 0, rowHeight: 0, ...at, total: rows });

  const range = windowAt(scrollTopRef.current, box, total);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const measure = () => {
    const el = scrollerRef.current;
    // A zero viewport is no measurement: `docs/map/invariant/zero-is-no-measurement.md`.
    if (!el || el.clientHeight <= 0) return;
    const first = canvasRef.current?.firstElementChild;
    const row = first === notARowRef.current ? null : first;
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const view = el.getBoundingClientRect();
    const next = {
      viewportHeight: el.clientHeight,
      // The row's height is read in layout px, not on screen:
      // `docs/map/invariant/lengths-are-layout-px.md`.
      rowHeight: rowLayoutHeight(row) || rowHeightRemRef.current * rootPx,
      canvasTop: canvasTopOf(el, view, canvasRef.current),
    };
    const prev = boxRef.current;
    // A sub-px move of the offset is no change, deliberately: `docs/map/territory/row-windowing.md`.
    if (
      prev &&
      prev.viewportHeight === next.viewportHeight &&
      prev.rowHeight === next.rowHeight &&
      Math.abs(prev.canvasTop - next.canvasTop) < 1
    ) {
      return;
    }
    boxRef.current = next;
    setBox(next);
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
    // Not on `canvasTop` alone, deliberately: `docs/map/territory/row-windowing.md`.
  }, [focus, box?.viewportHeight, box?.rowHeight]);

  useEffect(() => {
    if (box && keyboard) keyboard.rowsPerPage = Math.floor(box.viewportHeight / box.rowHeight);
  }, [box, keyboard]);

  return {
    box,
    range,
    // `right: 0` as well as `left` is deliberate:
    // `docs/map/invariant/drawn-columns-are-tracks-are-cells.md`.
    place: (index) =>
      box ? { position: 'absolute', top: index * box.rowHeight, left: 0, right: 0 } : undefined,
    onScroll: (scrollTop) => {
      scrollTopRef.current = scrollTop;
      const next = windowAt(scrollTop, boxRef.current, totalRef.current);
      const drawn = rangeRef.current;
      if (next.start !== drawn.start || next.end !== drawn.end) redraw();
    },
    measure,
  };
}

/** A computed length in px; `0` where it is not a length, as `auto` and `medium` are not. */
const lengthPx = (value: string) => Number.parseFloat(value) || 0;

/**
 * The sampled row's height in layout px, from its computed style: the box its `height` names, plus
 * its vertical padding and borders where that box is the content box. `0` with no row, or where the
 * height is no length — which sends `measure` to its `rowHeightRem` fallback.
 */
function rowLayoutHeight(row: Element | null | undefined): number {
  if (!row) return 0;
  const style = getComputedStyle(row);
  const height = Number.parseFloat(style.height);
  // A height that is not positive, NaN included, is no measurement:
  // `docs/map/invariant/zero-is-no-measurement.md`.
  if (!(height > 0)) return 0;
  if (style.boxSizing !== 'content-box') return height;
  return (
    height +
    lengthPx(style.paddingTop) +
    lengthPx(style.paddingBottom) +
    lengthPx(style.borderTopWidth) +
    lengthPx(style.borderBottomWidth)
  );
}

/**
 * The canvas's top offset in the scroller's content, in layout px, read from the elements. `0` with
 * no canvas, or while the scroller has no height on screen.
 */
function canvasTopOf(scroller: HTMLDivElement, view: DOMRect, canvas: HTMLDivElement | null): number {
  // A zero screen box is no measurement: `docs/map/invariant/zero-is-no-measurement.md`.
  if (!canvas || !(view.height > 0)) return 0;
  const at = canvas.getBoundingClientRect();
  // Scaled over the longer element, as the marquee is: `docs/map/territory/row-windowing.md`.
  const scale = longScale({
    scrollerScreen: view.height,
    scrollerLayout: scroller.offsetHeight,
    canvasScreen: at.height,
    canvasLayout: canvas.offsetHeight,
  });
  return canvasOffset({
    canvasEdge: at.top,
    viewEdge: view.top + scroller.clientTop * scale,
    scale,
    scroll: scroller.scrollTop,
  });
}
