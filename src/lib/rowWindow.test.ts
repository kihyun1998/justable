/**
 * Which rows are worth drawing, and where to scroll to reveal one.
 *
 * The arithmetic lives on its own because it is the half that can be wrong *quietly*: an off-by-one
 * shows up as a row missing at the edge of the viewport, which looks like a rendering glitch rather
 * than a bug in a number.
 */
import { describe, expect, it } from 'vitest';

import { BLOCK_ROWS, scrollToReveal, visibleRange } from './rowWindow.js';

/**
 * The largest step a consumer's drag edge-scroll moves in one frame, in px. PenTerm's is 48, and its
 * own suite checks its constant against this function.
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
   * row makes every scroll frame a React render — measured, that cost 51–58ms p95 against an 18ms
   * baseline. Snapping means a one-row scroll usually changes nothing at all.
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
   * window (47, the-explorer-sees-one-folder-at-a-time 11). The row under either edge after one step, up
   * or down, must already be drawn.
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
   * ⚠️ **The guard that matters most.** `rowHeight` is measured from the DOM, and a measurement can
   * arrive as 0 — before first paint, or in a pane whose size is still zero. Dividing by it then
   * yields `Infinity`, and a range of `0..Infinity` renders every row of a 5000-entry folder, which
   * is precisely the three-second freeze this ticket exists to remove. Failing safe means drawing
   * *few*, not *all*.
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
   * The window is bounded by the viewport, not by the folder. This is the whole point of the
   * ticket, expressed as an assertion: the same viewport asks for the same handful of rows whether
   * the folder holds ten entries or five thousand.
   */
  it('the window does not grow with the folder', () => {
    const small = visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 50 });
    const huge = visibleRange({ scrollTop: 0, viewportHeight: 200, rowHeight: R, total: 5000 });
    expect(huge.end - huge.start).toBe(small.end - small.start);
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
   * ⚠️ **A row straddling an edge is not "on screen".** Half a row is not readable, and the
   * arrow key that just landed there has to show what it landed on.
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
});
