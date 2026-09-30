/**
 * Moving through a table with the keyboard.
 *
 * The arithmetic is separated from the component because it is where the off-by-ones live, and
 * because a component test cannot easily ask "what would End do in an empty folder".
 */
import { describe, expect, it } from 'vitest';

import { nextFocusIndex, typeAheadIndex, typeAheadStep } from './tableKeyboard.js';

const ROWS_PER_PAGE = 7;

const move = (key: string, focus: number | null, total = 10) =>
  nextFocusIndex({ key, focus, total, rowsPerPage: ROWS_PER_PAGE });

describe('nextFocusIndex', () => {
  it('down and up step one row', () => {
    expect(move('ArrowDown', 3)).toBe(4);
    expect(move('ArrowUp', 3)).toBe(2);
  });

  it('stops at both ends rather than wrapping', () => {
    // Never wrapping is deliberate: `docs/map/territory/keyboard-movement.md`.
    expect(move('ArrowDown', 9)).toBe(9);
    expect(move('ArrowUp', 0)).toBe(0);
  });

  it('the first arrow lands on the first row when nothing is focused', () => {
    expect(move('ArrowDown', null)).toBe(0);
    expect(move('ArrowUp', null)).toBe(0);
  });

  it('Home and End go to the ends, whatever is focused', () => {
    expect(move('Home', 4)).toBe(0);
    expect(move('End', 4)).toBe(9);
    expect(move('End', null)).toBe(9);
  });

  it('a page is a viewport, and it clamps', () => {
    expect(move('PageDown', 0)).toBe(ROWS_PER_PAGE);
    expect(move('PageUp', 9)).toBe(9 - ROWS_PER_PAGE);
    expect(move('PageDown', 8)).toBe(9);
    expect(move('PageUp', 1)).toBe(0);
  });

  /**
   * ⚠️ **←/→ are declined, and this case pins it.** The table is `role="grid"`, whose APG pattern
   * is cell-first; why it declines: `docs/map/territory/keyboard-movement.md`.
   *
   * Declining is a decision, so it is pinned here rather than left as an absence. If left/right are
   * ever given a meaning, this case is where the argument has to be made.
   */
  it('left and right do nothing — cells are not the unit here', () => {
    expect(move('ArrowLeft', 4)).toBeNull();
    expect(move('ArrowRight', 4)).toBeNull();
  });

  it('keys it does not know are not its business', () => {
    for (const key of ['a', 'Enter', ' ', 'Escape', 'Tab', 'F2']) {
      expect(move(key, 4), key).toBeNull();
    }
  });

  /**
   * An empty list still receives key presses. Every movement has to answer "nowhere".
   */
  it('an empty folder has nowhere to go', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']) {
      expect(move(key, null, 0), key).toBeNull();
      expect(move(key, 0, 0), key).toBeNull();
    }
  });

  /**
   * ⚠️ `rowsPerPage` can arrive as 0 before layout, and a page must still move by something:
   * `docs/map/invariant/zero-is-no-measurement.md`.
   */
  it('a page never measures as zero movement', () => {
    expect(nextFocusIndex({ key: 'PageDown', focus: 0, total: 10, rowsPerPage: 0 })).toBe(1);
    expect(nextFocusIndex({ key: 'PageUp', focus: 5, total: 10, rowsPerPage: 0 })).toBe(4);
  });
});

describe('typeAheadIndex', () => {
  const NAMES = ['apple.txt', 'Banana', 'cherry', 'Cranberry', 'date'];

  it('finds the first name starting with the query', () => {
    expect(typeAheadIndex('c', NAMES, null)).toBe(2);
  });

  it('ignores case, in both directions', () => {
    expect(typeAheadIndex('b', NAMES, null)).toBe(1);
    expect(typeAheadIndex('B', NAMES, null)).toBe(1);
  });

  it('a longer query narrows rather than restarts', () => {
    expect(typeAheadIndex('cr', NAMES, null)).toBe(3);
  });

  /**
   * Typing the same letter again is how a user walks the matches — it must advance from where they
   * are, not return to the first match every time.
   */
  it('searches from after the current row', () => {
    expect(typeAheadIndex('c', NAMES, 2)).toBe(3);
  });

  it('wraps around the end', () => {
    expect(typeAheadIndex('a', NAMES, 3)).toBe(0);
  });

  it('says nothing when nothing matches', () => {
    expect(typeAheadIndex('z', NAMES, null)).toBeNull();
    expect(typeAheadIndex('', NAMES, null)).toBeNull();
    expect(typeAheadIndex('a', [], null)).toBeNull();
  });

  /**
   * ⚠️ The list is in **screen order**, which is the sorted order and not the filesystem's. Passing
   * the wrong array makes type-ahead land on a row other than the one it names.
   */
  it('answers positions in the order it was given', () => {
    expect(typeAheadIndex('c', ['cherry', 'Cranberry'], null)).toBe(0);
    expect(typeAheadIndex('c', ['Cranberry', 'cherry'], null)).toBe(0);
    expect(typeAheadIndex('ch', ['Cranberry', 'cherry'], null)).toBe(1);
  });
});

describe('typeAheadStep', () => {
  it('a pause starts a new one-letter query, searched after the row', () => {
    expect(typeAheadStep('cra', 'b', true)).toEqual({ query: 'b', after: true });
  });

  /**
   * ⚠️ **The rule people expect without naming it.** `c` `c` `c` cycles the c-names; it does not
   * search for "ccc", which matches nothing and makes the key look broken.
   */
  it('the same letter again walks instead of extending', () => {
    expect(typeAheadStep('c', 'c', false)).toEqual({ query: 'c', after: true });
  });

  it('the same letter in the other case walks too, as matching ignores case', () => {
    expect(typeAheadStep('c', 'C', false)).toEqual({ query: 'C', after: true });
    expect(typeAheadStep('C', 'c', false)).toEqual({ query: 'c', after: true });
  });

  it('a different letter extends, so c then h narrows onto cherry', () => {
    expect(typeAheadStep('c', 'h', false)).toEqual({ query: 'ch', after: false });
  });

  /**
   * Only a *single* repeated letter walks. Once the query is longer the user is spelling a name,
   * and `cr` + `r` must look for `crr` rather than cycling the c-names.
   */
  it('a repeat inside a longer query is still an extension', () => {
    expect(typeAheadStep('cr', 'r', false)).toEqual({ query: 'crr', after: false });
  });
});
