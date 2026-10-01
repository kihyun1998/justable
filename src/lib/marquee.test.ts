/**
 * Which rows a marquee's vertical span touches, and where its press, pointer and rectangle lie, in
 * canvas px, over plain numbers. Tested apart from the grid:
 * `docs/map/territory/verification-gates.md`.
 */
import { describe, expect, it } from 'vitest';

import { screenScale } from './rowWindow.js';

import {
  marqueeFrame,
  marqueeRange,
  marqueeRectangle,
  marqueeScale,
  marqueeView,
  pressOnScrollbar,
  toCanvas,
} from './marquee.js';

/** 28px rows, ten of them: the canvas is 280px tall. */
const R = 28;
const touched = (from: number, to: number, total = 10) =>
  marqueeRange({ from, to, rowHeight: R, total });

describe('marqueeRange', () => {
  it('a span inside one row touches that row alone', () => {
    expect(touched(30, 40)).toEqual({ anchor: 1, head: 1 });
  });

  it('dragging down: the anchor is the pressed row, the head the row under the pointer', () => {
    expect(touched(30, 100)).toEqual({ anchor: 1, head: 3 });
  });

  it('dragging up: the head is above the anchor', () => {
    expect(touched(100, 30)).toEqual({ anchor: 3, head: 1 });
  });

  it('⚠️ a span ending exactly on a row border does not touch the row below it', () => {
    // 56 is row 2's top edge: the span reaches it and overlaps none of row 2.
    expect(touched(30, 56)).toEqual({ anchor: 1, head: 1 });
    // One px further, it does.
    expect(touched(30, 57)).toEqual({ anchor: 1, head: 2 });
  });

  it('⚠️ a span starting exactly on a row border starts in the row below it', () => {
    expect(touched(56, 60)).toEqual({ anchor: 2, head: 2 });
  });

  it('a zero-height span — a horizontal drag — touches the row it lies in', () => {
    expect(touched(40, 40)).toEqual({ anchor: 1, head: 1 });
    // ⚠️ On a border too: it lies in the row below, and must not come out reversed.
    expect(touched(56, 56)).toEqual({ anchor: 2, head: 2 });
  });

  it('a span wholly in the floor below the last row touches nothing', () => {
    expect(touched(300, 400)).toBeNull();
  });

  it('⚠️ a press in the floor anchors on the last row once the span reaches it', () => {
    expect(touched(400, 279)).toEqual({ anchor: 9, head: 9 });
    expect(touched(400, 200)).toEqual({ anchor: 9, head: 7 });
  });

  it('⚠️ the floor starts at the last row’s bottom edge, which touches nothing', () => {
    expect(touched(400, 280)).toBeNull();
  });

  it('a span past the last row stops at the last row', () => {
    expect(touched(250, 900)).toEqual({ anchor: 8, head: 9 });
  });

  it('a span above the first row — a press on a leading row — starts at row 0', () => {
    expect(touched(-20, 40)).toEqual({ anchor: 0, head: 1 });
    expect(touched(-40, -10)).toBeNull();
  });

  it('no rows, or no measured row, touches nothing', () => {
    expect(touched(0, 100, 0)).toBeNull();
    expect(marqueeRange({ from: 0, to: 100, rowHeight: 0, total: 10 })).toBeNull();
    expect(marqueeRange({ from: 0, to: 100, rowHeight: Number.NaN, total: 10 })).toBeNull();
  });
});

/**
 * A scroller whose border box starts at (100, 50) on screen, with a 2px left and a 3px top border: its
 * view — the inner box, scrollbars excluded — is 300 × 200 from (102, 53), so its inner right edge is
 * at x 402 and its inner bottom edge at y 253.
 */
const VIEW = marqueeView({
  boxLeft: 100,
  boxTop: 50,
  clientLeft: 2,
  clientTop: 3,
  clientWidth: 300,
  clientHeight: 200,
  scale: 1,
});

describe('pressOnScrollbar', () => {
  it('a press at or past the view’s inner right edge is on the vertical scrollbar', () => {
    expect(pressOnScrollbar(VIEW, 402, 100)).toBe(true);
    expect(pressOnScrollbar(VIEW, 410, 100)).toBe(true);
  });

  it('a press at or past the view’s inner bottom edge is on the horizontal scrollbar', () => {
    expect(pressOnScrollbar(VIEW, 200, 253)).toBe(true);
    expect(pressOnScrollbar(VIEW, 200, 260)).toBe(true);
  });

  it('⚠️ a press just inside either edge is not, the border counted', () => {
    expect(pressOnScrollbar(VIEW, 401, 100)).toBe(false);
    expect(pressOnScrollbar(VIEW, 200, 252)).toBe(false);
    expect(pressOnScrollbar(VIEW, 401, 252)).toBe(false);
  });

  it('a zero view width or height marks no scrollbar on that axis', () => {
    const flat = marqueeView({
      boxLeft: 100,
      boxTop: 50,
      clientLeft: 2,
      clientTop: 3,
      clientWidth: 0,
      clientHeight: 0,
      scale: 1,
    });
    expect(pressOnScrollbar(flat, 5000, 100)).toBe(false);
    expect(pressOnScrollbar(flat, 200, 5000)).toBe(false);
    // One axis unmeasured leaves the other's scrollbar in place.
    const narrow = { ...VIEW, width: 0 };
    expect(pressOnScrollbar(narrow, 5000, 100)).toBe(false);
    expect(pressOnScrollbar(narrow, 200, 253)).toBe(true);
  });
});

/**
 * The press's frame over `VIEW`: the canvas sits 8px right of the scroller's content edge, and 40px
 * of leading rows push it down; the content is 300 × 1000; the scroller has scrolled 100px down at
 * the press, so the canvas's client box is at (102 + 8, 53 + 40 − 100) = (110, −7).
 */
const pressFrame = (scrollWidth = 300, scrollHeight = 1000) =>
  marqueeFrame({
    view: VIEW,
    canvasLeft: 110,
    canvasTop: -7,
    scrollLeft: 0,
    scrollTop: 100,
    scrollWidth,
    scrollHeight,
  });

describe('marqueeFrame', () => {
  it('⚠️ bounds the rectangle to the scroller’s content in canvas px, leading rows above the canvas', () => {
    expect(pressFrame().bounds).toEqual({ left: -8, top: -40, right: 292, bottom: 960 });
  });

  it('the bounds do not depend on how far the scroller had scrolled at the press', () => {
    const unscrolled = marqueeFrame({
      view: VIEW,
      canvasLeft: 110,
      canvasTop: 93,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 300,
      scrollHeight: 1000,
    });
    expect(unscrolled.bounds).toEqual(pressFrame().bounds);
  });

  it('a zero scrollWidth or scrollHeight bounds nothing on that side', () => {
    expect(pressFrame(0, 1000).bounds).toEqual({ left: -8, top: -40, right: Infinity, bottom: 960 });
    expect(pressFrame(300, 0).bounds).toEqual({ left: -8, top: -40, right: 292, bottom: Infinity });
  });
});

describe('toCanvas', () => {
  it('a point in the view, unscrolled since the press, is its offset from the canvas’s client box', () => {
    // (200 − 110, 100 + 7)
    expect(toCanvas(pressFrame(), 200, 100, 0, 100)).toEqual({ x: 90, y: 107 });
  });

  it('⚠️ a scroll since the press moves the point by exactly the scroll delta', () => {
    expect(toCanvas(pressFrame(), 200, 100, 0, 160)).toEqual({ x: 90, y: 167 });
    expect(toCanvas(pressFrame(), 200, 100, 25, 40)).toEqual({ x: 115, y: 47 });
  });

  it('⚠️ a pointer outside the view counts at the view’s inner edge', () => {
    // Right and bottom: the inner edges at 402 and 253.
    expect(toCanvas(pressFrame(), 900, 900, 0, 100)).toEqual({ x: 292, y: 260 });
    // Left and top: the inner edges at 102 and 53, inside the border.
    expect(toCanvas(pressFrame(), 0, 0, 0, 100)).toEqual({ x: -8, y: 60 });
  });

  it('a zero view width or height clamps nothing on that axis', () => {
    const frame = { ...pressFrame(), view: { ...VIEW, width: 0, height: 0 } };
    expect(toCanvas(frame, 900, 900, 0, 100)).toEqual({ x: 790, y: 907 });
    expect(toCanvas(frame, 0, 0, 0, 100)).toEqual({ x: -110, y: 7 });
    // One axis unmeasured leaves the other's clamp in place.
    const narrow = { ...pressFrame(), view: { ...VIEW, width: 0 } };
    expect(toCanvas(narrow, 900, 900, 0, 100)).toEqual({ x: 790, y: 260 });
    const short = { ...pressFrame(), view: { ...VIEW, height: 0 } };
    expect(toCanvas(short, 900, 900, 0, 100)).toEqual({ x: 292, y: 907 });
  });
});

describe('marqueeRectangle', () => {
  /** `pressFrame()`'s content: x −8 … 292, y −40 … 960. */
  const bounds = { left: -8, top: -40, right: 292, bottom: 960 };

  it('spans the press and the pointer, whichever way the drag went', () => {
    const box = { left: 20, top: 30, width: 80, height: 70 };
    expect(marqueeRectangle(bounds, { x: 20, y: 30 }, { x: 100, y: 100 })).toEqual(box);
    expect(marqueeRectangle(bounds, { x: 100, y: 100 }, { x: 20, y: 30 })).toEqual(box);
  });

  it('⚠️ stays inside the content on all four sides', () => {
    expect(marqueeRectangle(bounds, { x: 20, y: 30 }, { x: -50, y: -90 })).toEqual({
      left: -8,
      top: -40,
      width: 28,
      height: 70,
    });
    expect(marqueeRectangle(bounds, { x: 20, y: 30 }, { x: 400, y: 1200 })).toEqual({
      left: 20,
      top: 30,
      width: 272,
      height: 930,
    });
  });

  it('an unmeasured side bounds nothing', () => {
    const open = { ...bounds, right: Infinity, bottom: Infinity };
    expect(marqueeRectangle(open, { x: 20, y: 30 }, { x: 400, y: 1200 })).toEqual({
      left: 20,
      top: 30,
      width: 380,
      height: 1170,
    });
  });
});

describe('the frame, the point and the rectangle together', () => {
  it('a zero scrollWidth or scrollHeight lets the rectangle follow the pointer past the content', () => {
    const frame = pressFrame(0, 0);
    const origin = toCanvas(frame, 200, 100, 0, 100);
    // The pointer at the view's bottom-right corner, after a 2000px scroll down since the press.
    const here = toCanvas(frame, 402, 253, 0, 2100);
    expect(marqueeRectangle(frame.bounds, origin, here)).toEqual({
      left: 90,
      top: 107,
      width: 202,
      height: 2153,
    });
  });
});

/**
 * `VIEW`'s scroller inside a CSS `scale(s)` whose origin is its border box's top-left corner at
 * (100, 50): every layout length — the borders, the inner box, the canvas's offset — is `s` times as
 * long on screen. The layout lengths are `VIEW`'s and `pressFrame`'s.
 */
const scaledView = (scale: number) =>
  marqueeView({
    boxLeft: 100,
    boxTop: 50,
    clientLeft: 2,
    clientTop: 3,
    clientWidth: 300,
    clientHeight: 200,
    scale,
  });

describe('inside a scaled copy', () => {
  it('a scale screenScale snaps to 1 builds the unscaled view', () => {
    const snapped = marqueeView({
      boxLeft: 100,
      boxTop: 50,
      clientLeft: 2,
      clientTop: 3,
      clientWidth: 300,
      clientHeight: 200,
      scale: screenScale(200.4, 200),
    });
    expect(snapped).toEqual(VIEW);
  });

  it('⚠️ at 0.5, the scrollbar starts at the inner edge on screen, the border scaled too', () => {
    // Inner box on screen: (100 + 2·0.5, 50 + 3·0.5) = (101, 51.5), 150 × 100.
    const view = scaledView(0.5);
    expect(pressOnScrollbar(view, 251, 100)).toBe(true);
    expect(pressOnScrollbar(view, 250, 100)).toBe(false);
    expect(pressOnScrollbar(view, 200, 151.5)).toBe(true);
    expect(pressOnScrollbar(view, 200, 151)).toBe(false);
  });

  it('⚠️ at 2, a press in the view’s lower half on screen is not on a scrollbar', () => {
    // Inner box on screen: (100 + 2·2, 50 + 3·2) = (104, 56), 600 × 400.
    const view = scaledView(2);
    expect(pressOnScrollbar(view, 500, 300)).toBe(false);
    expect(pressOnScrollbar(view, 703, 455)).toBe(false);
    expect(pressOnScrollbar(view, 704, 300)).toBe(true);
    expect(pressOnScrollbar(view, 500, 456)).toBe(true);
  });

  /**
   * `pressFrame`'s layout — the canvas 8px right of the content's edge and 40px down, the scroller
   * 100px down at the press — drawn at `scale`: the canvas's client box is the inner box's corner
   * plus (8, 40 − 100) times the scale.
   */
  const scaledFrame = (scale: number, scrollWidth = 300, scrollHeight = 1000) => {
    const view = scaledView(scale);
    return marqueeFrame({
      view,
      canvasLeft: view.left + 8 * scale,
      canvasTop: view.top + (40 - 100) * scale,
      scrollLeft: 0,
      scrollTop: 100,
      scrollWidth,
      scrollHeight,
    });
  };

  it('⚠️ the content bounds are in layout px, the same at any scale', () => {
    // The canvas on screen at 0.5: (101 + 4, 51.5 − 30) = (105, 21.5); at 2: (104 + 16, 56 − 120)
    // = (120, −64).
    expect(scaledFrame(0.5).canvasTop).toBe(21.5);
    expect(scaledFrame(2).canvasLeft).toBe(120);
    for (const scale of [0.5, 2]) {
      expect(scaledFrame(scale).bounds, String(scale)).toEqual({
        left: -8,
        top: -40,
        right: 292,
        bottom: 960,
      });
    }
  });

  it('⚠️ at 0.5, a point is its screen distance from the canvas, doubled, plus the scroll since the press', () => {
    // ((200 − 105) / 0.5, (100 − 21.5) / 0.5)
    expect(toCanvas(scaledFrame(0.5), 200, 100, 0, 100)).toEqual({ x: 190, y: 157 });
    // The scroll is layout px already: 60px more scroll is 60px further down, not 120.
    expect(toCanvas(scaledFrame(0.5), 200, 100, 25, 160)).toEqual({ x: 215, y: 217 });
  });

  it('⚠️ at 2, a point is its screen distance from the canvas, halved, plus the scroll since the press', () => {
    // ((200 − 120) / 2, (100 + 64) / 2)
    expect(toCanvas(scaledFrame(2), 200, 100, 0, 100)).toEqual({ x: 40, y: 82 });
    expect(toCanvas(scaledFrame(2), 200, 100, 25, 160)).toEqual({ x: 65, y: 142 });
  });

  it('⚠️ a pointer outside the view counts at its inner edge on screen, which is the unscaled one in layout', () => {
    for (const scale of [0.5, 2]) {
      const frame = scaledFrame(scale);
      expect(toCanvas(frame, 9000, 9000, 0, 100), String(scale)).toEqual({ x: 292, y: 260 });
      expect(toCanvas(frame, -9000, -9000, 0, 100), String(scale)).toEqual({ x: -8, y: 60 });
    }
  });

  it('⚠️ a drag over rows 3 to 6 on screen touches rows 3 to 6, at 0.5 and at 2', () => {
    // Rows are 28 layout px; the middle of row 3 is at 98 on the canvas, row 6's at 182.
    for (const scale of [0.5, 2]) {
      const frame = scaledFrame(scale);
      const onScreen = (y: number) => frame.canvasTop + y * scale;
      const from = toCanvas(frame, 200, onScreen(98), 0, 100).y;
      const to = toCanvas(frame, 200, onScreen(182), 0, 100).y;
      const range = marqueeRange({ from, to, rowHeight: 28, total: 40 });
      expect(range, String(scale)).toEqual({ anchor: 3, head: 6 });
    }
  });
});

describe('marqueeScale', () => {
  /** Under `scale(0.5)`, as measured in Chrome: a 654.203 px scroller and a 139957 px canvas. */
  const SCROLLER = { scrollerScreen: 327.1015625, scrollerLayout: 654 };

  it('⚠️ takes a long canvas’s ratio, whose whole-px rounding is the smaller share of its length', () => {
    const scale = marqueeScale({ ...SCROLLER, canvasScreen: 69978.265625, canvasLayout: 139957 });
    expect(Math.abs(scale - 0.5)).toBeLessThan(0.00001);
  });

  it('⚠️ takes the scroller’s ratio for a canvas shorter than the scroller, or empty', () => {
    const scrollers = 327.1015625 / 654;
    expect(marqueeScale({ ...SCROLLER, canvasScreen: 42.3, canvasLayout: 84 })).toBe(scrollers);
    expect(marqueeScale({ ...SCROLLER, canvasScreen: 0, canvasLayout: 0 })).toBe(scrollers);
  });

  it('is 1 where nothing is measured, as under jsdom', () => {
    expect(
      marqueeScale({ scrollerScreen: 0, scrollerLayout: 0, canvasScreen: 0, canvasLayout: 0 }),
    ).toBe(1);
  });
});
