/**
 * Which rows a windowed list draws, where to scroll to bring one into view, and the scale and canvas
 * offset the grid and its marquee measure with. The rules and their reasons:
 * `docs/map/territory/row-windowing.md`.
 */
import type { RowWindow } from '../types.js';

export interface VisibleRangeInput {
  /** The scroller's `scrollTop`, in px. */
  scrollTop: number;
  /** The scroller's visible height, in px. */
  viewportHeight: number;
  /** One row's measured height, in px. */
  rowHeight: number;
  /** How many rows the list has in all. */
  total: number;
  /** The rows' canvas's offset in the scroller's content, in px; rows above it push it down. 0 when absent. */
  canvasTop?: number;
}

/** Rows drawn while the viewport has never been measured. */
export const UNMEASURED_ROWS = 200;

/** The window's start snaps to a multiple of this, and a block this size is drawn past each edge. */
export const BLOCK_ROWS = 8;

export function visibleRange({
  scrollTop,
  viewportHeight,
  rowHeight,
  total,
  canvasTop = 0,
}: VisibleRangeInput): RowWindow {
  if (total <= 0) return { start: 0, end: 0 };

  // Negated on purpose, so NaN lands here too: `docs/map/territory/row-windowing.md`.
  if (!(rowHeight > 0)) {
    return { start: 0, end: Math.min(total, UNMEASURED_ROWS) };
  }

  const first = Math.floor(Math.max(0, scrollTop - canvasTop) / rowHeight);
  // The `+ 1` is deliberate: `docs/map/territory/row-windowing.md`.
  const span = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1;

  const snapped = Math.min(Math.floor(first / BLOCK_ROWS) * BLOCK_ROWS, Math.max(0, total - 1));
  // A whole block past either edge, deliberately: `docs/map/territory/row-windowing.md`.
  const start = Math.max(0, snapped - BLOCK_ROWS);
  return { start, end: Math.min(total, snapped + span + 2 * BLOCK_ROWS) };
}

/**
 * Screen px per layout px, from one element's height on screen and in layout. `1` while either
 * length is unmeasured, or while the two differ by less than one px.
 */
export function screenScale(screenHeight: number, layoutHeight: number): number {
  // Zero is no measurement: `docs/map/invariant/zero-is-no-measurement.md`.
  if (!(Number.isFinite(screenHeight) && screenHeight > 0)) return 1;
  if (!(Number.isFinite(layoutHeight) && layoutHeight > 0)) return 1;
  // The snap to 1 is deliberate: `docs/map/territory/row-windowing.md`.
  if (Math.abs(screenHeight - layoutHeight) < 1) return 1;
  return screenHeight / layoutHeight;
}

export interface LongScaleInput {
  /** The scroller's height on screen (`getBoundingClientRect`) and in layout (`offsetHeight`). */
  scrollerScreen: number;
  scrollerLayout: number;
  /** The rows' canvas's height on screen and in layout. */
  canvasScreen: number;
  canvasLayout: number;
}

/**
 * Screen px per layout px: `screenScale` over the longer of the scroller and the canvas. The reason:
 * `docs/map/territory/marquee.md`.
 */
export function longScale({
  scrollerScreen,
  scrollerLayout,
  canvasScreen,
  canvasLayout,
}: LongScaleInput): number {
  return canvasLayout > scrollerLayout
    ? screenScale(canvasScreen, canvasLayout)
    : screenScale(scrollerScreen, scrollerLayout);
}

export interface CanvasOffsetInput {
  /** The canvas's client edge on screen on one axis: its `getBoundingClientRect()` left or top. */
  canvasEdge: number;
  /** The scroller's inner edge on screen on that axis, its border included, in screen px. */
  viewEdge: number;
  /** Screen px per layout px. */
  scale: number;
  /** The scroller's scroll offset on that axis, in layout px. */
  scroll: number;
}

/** The canvas's offset in the scroller's content on one axis, in layout px. */
export function canvasOffset({ canvasEdge, viewEdge, scale, scroll }: CanvasOffsetInput): number {
  return (canvasEdge - viewEdge) / scale + scroll;
}

export interface RevealInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  /** The rows' canvas's offset in the scroller's content, in px; rows above it push it down. 0 when absent. */
  canvasTop?: number;
}

/**
 * The `scrollTop` that brings row `index` fully into view, or `null` if it already is. A row
 * straddling an edge counts as not visible. Revealing row 0 upward scrolls to 0, so the rows above the
 * canvas show with it, unless row 0 would then still not be wholly in view.
 */
export function scrollToReveal(
  index: number,
  { scrollTop, viewportHeight, rowHeight, canvasTop = 0 }: RevealInput,
): number | null {
  if (!(rowHeight > 0) || !(viewportHeight > 0)) return null;

  const top = canvasTop + index * rowHeight;
  const bottom = top + rowHeight;

  // Row 0 to the very top, deliberately: `docs/map/territory/row-windowing.md`.
  if (top < scrollTop) return index > 0 || bottom > viewportHeight ? Math.max(0, top) : 0;
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight);
  return null;
}
