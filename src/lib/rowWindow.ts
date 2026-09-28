/**
 * Which rows a windowed list draws, and where to scroll to bring one into view. The rules and their
 * reasons: `docs/map/territory/row-windowing.md`.
 */
import type { RowWindow } from '../types.js';

export interface VisibleRangeInput {
  /** The scroller's `scrollTop`, in px. */
  scrollTop: number;
  /** The scroller's visible height, in px. */
  viewportHeight: number;
  /** One row's measured height, in px — it varies with font size, so never a constant. */
  rowHeight: number;
  /** How many rows the list has in all. */
  total: number;
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
}: VisibleRangeInput): RowWindow {
  if (total <= 0) return { start: 0, end: 0 };

  // Negated on purpose, so NaN lands here too: `docs/map/territory/row-windowing.md`.
  if (!(rowHeight > 0)) {
    return { start: 0, end: Math.min(total, UNMEASURED_ROWS) };
  }

  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  // The `+ 1` is deliberate: `docs/map/territory/row-windowing.md`.
  const span = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1;

  const snapped = Math.min(Math.floor(first / BLOCK_ROWS) * BLOCK_ROWS, Math.max(0, total - 1));
  // A whole block past either edge, deliberately: `docs/map/territory/row-windowing.md`.
  const start = Math.max(0, snapped - BLOCK_ROWS);
  return { start, end: Math.min(total, snapped + span + 2 * BLOCK_ROWS) };
}

export interface RevealInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
}

/**
 * The `scrollTop` that brings row `index` fully into view, or `null` if it already is. A row
 * straddling an edge counts as not visible.
 */
export function scrollToReveal(
  index: number,
  { scrollTop, viewportHeight, rowHeight }: RevealInput,
): number | null {
  if (!(rowHeight > 0) || !(viewportHeight > 0)) return null;

  const top = index * rowHeight;
  const bottom = top + rowHeight;

  if (top < scrollTop) return Math.max(0, top);
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight);
  return null;
}
