/**
 * Which rows are worth drawing, and where to scroll to reveal one. Why this arithmetic is tested
 * apart: `docs/map/territory/verification-gates.md`.
 */
import { describe, expect, it } from 'vitest';

import { BLOCK_ROWS, screenScale, scrollToReveal, visibleRange } from './rowWindow.js';

/**
 * The largest step a consumer's drag edge-scroll moves in one frame, in px:
 * `docs/map/territory/row-windowing.md`.
 */
const EDGE_SCROLL_MAX_STEP = 48;

/** 28px rows in a 200px viewport — the measured height at a 16px root. */
const R = 28;

describe('visibleRange', () => {
  it('at the top, it starts at the first row', () => {
    expect(
      visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 5000 }).start,
    ).toBe(0);
  });

  it('covers the whole viewport — the last partly visible row is drawn, not clipped away', () => {
    // 200 / 28 = 7.14 rows, so seven whole ones and part of an eighth are on screen.
    const { start, end } = visibleRange({
      scrollTop: 0,
      viewportHeight: 200,
      rowHeight: R,
      total: 5000,
    });
    expect(start).toBe(0);
    expect(end).toBeGreaterThanOrEqual(8);
  });

  /**
   * ⚠️ **The window moves in blocks, and this case is the reason.** Recomputing on every crossed
   * row makes every scroll frame a React render; snapping means a one-row scroll usually changes
   * nothing at all.
   */
  it('a one-row scroll inside a block does not move the window', () => {
    const a = visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 5000 });
    const b = visibleRange({ scrollTop: R, viewportHeight: 200, rowHeight: R, total: 5000 });
    expect(b).toEqual(a);
  });

  it('crossing a block boundary moves it by exactly one block', () => {
    const a = visibleRange({
      scrollTop: R * BLOCK_ROWS,
      viewportHeight: 200,
      rowHeight: R,
      total: 5000,
    });
    const b = visibleRange({
      scrollTop: R * BLOCK_ROWS * 2,
      viewportHeight: 200,
      rowHeight: R,
      total: 5000,
    });
    expect(b.start - a.start).toBe(BLOCK_ROWS);
  });

  /**
   * Snapping must never uncover the top of the viewport: the block start is *below* the first
   * visible row, so everything between them is drawn too.
   */
  it('the snapped start is never past the first visible row', () => {
    for (const scrollTop of [0, 5, R, R * 3 + 9, R * 7, R * 8, R * 137 + 1]) {
      const { start, end } = visibleRange({
        scrollTop,
        viewportHeight: 200,
        rowHeight: R,
        total: 5000,
      });
      const firstVisible = Math.floor(scrollTop / R);
      const lastVisible = Math.floor((scrollTop + 200) / R);
      expect(start, `start at ${scrollTop}`).toBeLessThanOrEqual(firstVisible);
      expect(end, `end at ${scrollTop}`).toBeGreaterThan(lastVisible);
    }
  });

  /**
   * ⚠️ The scroll position is **not** a multiple of the row height in general — a wheel notch lands
   * mid-row. The row straddling the top edge must still be drawn, or there is a gap the height of
   * the overlap.
   */
  it('a part-scrolled row at the top edge is still drawn', () => {
    const { start } = visibleRange({
      scrollTop: R * 3 + 5,
      viewportHeight: 200,
      rowHeight: R,
      total: 5000,
    });
    expect(start).toBeLessThanOrEqual(3);
  });

  /**
   * A drag's edge scroll moves the scroller and hit-tests the same frame, before a re-render moves the
   * window. The row under either edge after one step, up or down, must already be drawn.
   */
  it('one edge-scroll step either way never uncovers an undrawn row at an edge', () => {
    for (const rowHeight of [R, 24]) {
      for (let scrollTop = 0; scrollTop < rowHeight * 64; scrollTop += 5) {
        const { start, end } = visibleRange({
          scrollTop,
          viewportHeight: 200,
          rowHeight,
          total: 5000,
        });
        for (let step = 1; step <= EDGE_SCROLL_MAX_STEP; step++) {
          const up = Math.max(0, scrollTop - step);
          expect(Math.floor(up / rowHeight), `up ${step} from ${scrollTop}`).toBeGreaterThanOrEqual(
            start,
          );
          expect(
            Math.floor((scrollTop + step + 199) / rowHeight),
            `down ${step} from ${scrollTop}`,
          ).toBeLessThan(end);
        }
      }
    }
  });

  it('never runs past the end', () => {
    const { start, end } = visibleRange({
      scrollTop: 999_999,
      viewportHeight: 200,
      rowHeight: R,
      total: 10,
    });
    expect(end).toBe(10);
    expect(start).toBeLessThanOrEqual(10);
    expect(start).toBeGreaterThanOrEqual(0);
  });

  it('a folder smaller than the viewport draws all of it', () => {
    expect(visibleRange({ scrollTop: 0, viewportHeight: 900, rowHeight: R, total: 4 })).toEqual({
      start: 0,
      end: 4,
    });
  });

  it('an empty folder asks for nothing', () => {
    expect(visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 0 })).toEqual({
      start: 0,
      end: 0,
    });
  });

  /**
   * ⚠️ **The guard that matters most.** A measured row height can arrive as 0, and dividing by it
   * must never ask for every row: `docs/map/invariant/zero-is-no-measurement.md`.
   */
  it('a zero or nonsense row height does not ask for every row', () => {
    for (const rowHeight of [0, -1, Number.NaN]) {
      const { start, end } = visibleRange({
        scrollTop: 0,
        viewportHeight: 200,
        rowHeight,
        total: 5000,
      });
      expect(Number.isFinite(start), `start for rowHeight=${rowHeight}`).toBe(true);
      expect(Number.isFinite(end), `end for rowHeight=${rowHeight}`).toBe(true);
      expect(end - start, `window for rowHeight=${rowHeight}`).toBeLessThanOrEqual(200);
    }
  });

  /**
   * The window is bounded by the viewport, not by the list: the same viewport asks for the same
   * handful of rows whether the list holds ten entries or five thousand.
   */
  it('the window does not grow with the folder', () => {
    const small = visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 50 });
    const huge = visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 5000 });
    expect(huge.end - huge.start).toBe(small.end - small.start);
  });

  /** ⚠️ Twelve rows above the canvas, past one block: `docs/map/territory/row-windowing.md`. */
  it('counts the first visible row from the canvas, below the rows above it', () => {
    const canvasTop = 12 * R;
    for (let scrollTop = 0; scrollTop <= 900; scrollTop += 7) {
      const { start, end } = visibleRange({
        scrollTop,
        viewportHeight: 200,
        rowHeight: R,
        total: 5000,
        canvasTop,
      });
      const firstVisible = Math.floor(Math.max(0, scrollTop - canvasTop) / R);
      const lastVisible = Math.floor(Math.max(0, scrollTop + 200 - canvasTop) / R);
      expect(start, `start at ${scrollTop}`).toBeLessThanOrEqual(firstVisible);
      expect(end, `end at ${scrollTop}`).toBeGreaterThan(lastVisible);
    }
  });

  it('starts at the first row while the rows above the canvas are in view', () => {
    expect(
      visibleRange({ scrollTop: 300, viewportHeight: 200, rowHeight: R, total: 5000, canvasTop: 12 * R })
        .start,
    ).toBe(0);
  });
});

describe('scrollToReveal', () => {
  const V = { viewportHeight: 200, rowHeight: 28 };

  it('a row already fully on screen needs no scroll', () => {
    expect(scrollToReveal(3, { scrollTop: 0, ...V })).toBeNull();
  });

  it('a row above the viewport comes to the top edge', () => {
    expect(scrollToReveal(2, { scrollTop: 400, ...V })).toBe(2 * 28);
  });

  it('a row below the viewport comes to the bottom edge, not the top', () => {
    // Landing it at the top would jump the whole list for a one-row move.
    expect(scrollToReveal(10, { scrollTop: 0, ...V })).toBe(11 * 28 - 200);
  });

  /**
   * ⚠️ **A row straddling an edge is not "on screen"**: `docs/map/territory/row-windowing.md`.
   */
  it('a row only half visible at the bottom is brought fully in', () => {
    // 200 / 28 = 7.14 rows, so row 7 is cut off at scrollTop 0.
    expect(scrollToReveal(7, { scrollTop: 0, ...V })).toBe(8 * 28 - 200);
  });

  it('an unmeasured viewport asks for nothing rather than guessing', () => {
    expect(scrollToReveal(50, { scrollTop: 0, viewportHeight: 0, rowHeight: 28 })).toBeNull();
    expect(scrollToReveal(50, { scrollTop: 0, viewportHeight: 200, rowHeight: 0 })).toBeNull();
  });

  it('never asks to scroll above the top', () => {
    expect(scrollToReveal(0, { scrollTop: 100, ...V })).toBe(0);
  });

  describe('below rows above the canvas', () => {
    /** One leading row, as a file list's `..`. */
    const below = { ...V, canvasTop: 28 };

    it('a row below the viewport comes to the bottom edge, counted from the canvas', () => {
      expect(scrollToReveal(10, { scrollTop: 0, ...below })).toBe(28 + 11 * 28 - 200);
    });

    it('a row above the viewport comes to the top edge, counted from the canvas', () => {
      expect(scrollToReveal(5, { scrollTop: 400, ...below })).toBe(28 + 5 * 28);
    });

    /** ⚠️ Revealing the first row brings back the rows above it: `docs/map/territory/row-windowing.md`. */
    it('the first row scrolls to the very top, so the rows above it show again', () => {
      expect(scrollToReveal(0, { scrollTop: 400, ...V, canvasTop: 84 })).toBe(0);
      expect(scrollToReveal(0, { scrollTop: 40, ...below })).toBe(0);
    });

    it('the first row stops at its own top edge when the rows above it leave no room for it', () => {
      // Row 0 is at 84–112: scrolled to 0, a 50px viewport would still not show it.
      expect(scrollToReveal(0, { scrollTop: 400, viewportHeight: 50, rowHeight: 28, canvasTop: 84 })).toBe(
        84,
      );
    });

    it('a row on screen once the canvas is pushed down needs no scroll', () => {
      expect(scrollToReveal(3, { scrollTop: 0, ...below })).toBeNull();
    });

    it('a row the push moves past the bottom edge is brought fully in', () => {
      // Row 6 ends at 196 from the canvas, so at 224 in the scroller — past a 200px viewport.
      expect(scrollToReveal(6, { scrollTop: 0, ...below })).toBe(28 + 7 * 28 - 200);
    });
  });
});

describe('screenScale', () => {
  it('is the screen height over the layout height, for a scaled copy', () => {
    // Measured in Chrome under `scale(0.5)`: the scroller is 327.1015625 on screen and 654 in layout.
    expect(screenScale(327.1015625, 654)).toBe(327.1015625 / 654);
  });

  it('⚠️ is exactly 1 while the two differ by less than the layout reading rounds away', () => {
    // Measured in Chrome unscaled: 654.203125 on screen, an `offsetHeight` of 654.
    expect(screenScale(654.203125, 654)).toBe(1);
    expect(screenScale(568.59375, 569)).toBe(1);
  });

  it('is no measurement, so 1, for a zero, negative or non-finite length', () => {
    for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(screenScale(bad, 654)).toBe(1);
      expect(screenScale(327, bad)).toBe(1);
    }
  });
});
