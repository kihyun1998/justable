/**
 * Which rows a marquee's vertical span touches, in canvas px. Tested apart from the grid:
 * `docs/map/territory/verification-gates.md`.
 */
import { describe, expect, it } from 'vitest';

import { marqueeRange } from './marquee.js';

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
