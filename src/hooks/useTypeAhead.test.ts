// @vitest-environment jsdom
/**
 * Type-ahead on its own, for a list whose movement is not the table's.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTypeAhead } from './useTypeAhead.js';

/** The window most tests type within, in ms. */
const WINDOW = 500;

const NAMES = ['apple', 'banana', 'cherry', 'citrus', 'date', 'news.txt', 'new folder'];

function key(k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>> = {}) {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods, preventDefault: vi.fn() };
}

function setup(names: readonly string[] = NAMES, windowMs = WINDOW) {
  let clock = 1_000;
  const { result } = renderHook(() => useTypeAhead({ windowMs, now: () => clock }));
  return {
    step: (e: ReturnType<typeof key>, focus: number | null) =>
      result.current.step(e, { focus, names }),
    end: () => result.current.end(),
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('useTypeAhead', () => {
  it('answers where a letter lands and claims the event', () => {
    const { step } = setup();
    const e = key('c');
    expect(step(e, null)).toEqual({ to: 2 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('answers null for a key that is not type-ahead', () => {
    const { step } = setup();
    expect(step(key('ArrowDown'), 0)).toBeNull();
    expect(step(key('c', { ctrlKey: true }), 0)).toBeNull();
    expect(step(key(' '), 0)).toBeNull();
  });

  it('extends a running query with a space', () => {
    const { step } = setup();
    step(key('n'), null);
    step(key('e'), 5);
    step(key('w'), 5);
    expect(step(key(' '), 5)).toEqual({ to: 6 });
  });

  it('⚠️ end() stops a running query, so a space after it is not type-ahead', () => {
    const { step, end } = setup();
    step(key('n'), null);
    end();
    const e = key(' ');
    expect(step(e, 5)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('end() makes the next letter start a new query', () => {
    const { step, end } = setup();
    expect(step(key('c'), null)).toEqual({ to: 2 });
    end();
    // "d" alone lands on date; "cd" would match nothing.
    expect(step(key('d'), 2)).toEqual({ to: 4 });
  });

  it('⚠️ a miss clears the query, so the next letter starts over', () => {
    const { step } = setup();
    expect(step(key('c'), null)).toEqual({ to: 2 });
    const miss = key('x');
    expect(step(miss, 2)).toEqual({ to: null });
    expect(miss.preventDefault).not.toHaveBeenCalled();
    // Within the window: "d" alone lands on date; "cxd" would match nothing.
    expect(step(key('d'), 2)).toEqual({ to: 4 });
  });

  it('a pause longer than the window starts a new query', () => {
    const { step, advance } = setup();
    step(key('c'), null);
    advance(WINDOW + 1);
    expect(step(key('b'), 2)).toEqual({ to: 1 });
  });
});

describe('a fresh letter', () => {
  const FRUIT = ['apple', 'cherry', 'citrus', 'date'];

  it('⚠️ searches after the focused row, so a focused row that matches does not keep focus', () => {
    const { step } = setup(FRUIT);
    const e = key('c');
    expect(step(e, 1)).toEqual({ to: 2 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('lands on the focused row when it is the only match, and claims the event', () => {
    const { step } = setup(FRUIT);
    const e = key('d');
    expect(step(e, 3)).toEqual({ to: 3 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('wraps round to a match before the focused row', () => {
    const { step } = setup(FRUIT);
    expect(step(key('a'), 2)).toEqual({ to: 0 });
  });

  it('with no focused row, lands on the first match from the top', () => {
    const { step } = setup(['cherry', 'citrus', 'date']);
    expect(step(key('c'), null)).toEqual({ to: 0 });
  });

  it('after a pause, searches after the row the last query left', () => {
    const { step, advance } = setup(FRUIT);
    expect(step(key('c'), null)).toEqual({ to: 1 });
    expect(step(key('h'), 1)).toEqual({ to: 1 });
    advance(WINDOW + 1);
    // Fresh, `c` lands on citrus, after cherry; still running, "chc" would match nothing.
    expect(step(key('c'), 1)).toEqual({ to: 2 });
  });

  /** ⚠️ The rule this pins: `docs/map/territory/keyboard-movement.md`. */
  it('then narrows from the row it landed on, so c h e from cherry goes chive, chive, cherry', () => {
    const { step } = setup(['cherry', 'chive', 'citrus']);
    expect(step(key('c'), 0)).toEqual({ to: 1 });
    expect(step(key('h'), 1)).toEqual({ to: 1 });
    expect(step(key('e'), 1)).toEqual({ to: 0 });
  });
});

describe('the window is the consumer’s', () => {
  const FRUIT = ['apple', 'cherry', 'citrus', 'date'];

  /** `c` lands on cherry; `d` after it is "cd", a miss, inside the window, and date past it. */
  const afterPause = (windowMs: number, pause: number) => {
    const { step, advance } = setup(FRUIT, windowMs);
    step(key('c'), null);
    advance(pause);
    return step(key('d'), 1);
  };

  for (const windowMs of [300, 1000]) {
    it(`⚠️ with ${windowMs} ms, a letter at or inside it extends the query, and 1 ms past starts one`, () => {
      expect(afterPause(windowMs, windowMs - 1)).toEqual({ to: null });
      expect(afterPause(windowMs, windowMs)).toEqual({ to: null });
      expect(afterPause(windowMs, windowMs + 1)).toEqual({ to: 3 });
    });
  }

  it('⚠️ with 0, every character starts a fresh query, even in the same ms', () => {
    expect(afterPause(0, 0)).toEqual({ to: 3 });
    const { step } = setup(['news.txt', 'new folder'], 0);
    step(key('n'), null);
    expect(step(key(' '), 0)).toBeNull();
  });

  it('⚠️ a negative or NaN window keeps no query open, even on a clock that goes back', () => {
    for (const windowMs of [-5, Number.NaN]) {
      expect(afterPause(windowMs, 0), String(windowMs)).toEqual({ to: 3 });
      expect(afterPause(windowMs, -10), String(windowMs)).toEqual({ to: 3 });
    }
  });

  it('with Infinity, no pause ends a query; a miss still does', () => {
    expect(afterPause(Infinity, 1e9)).toEqual({ to: null });
    const { step, advance } = setup(FRUIT, Infinity);
    step(key('c'), null);
    advance(1e9);
    expect(step(key('h'), 1)).toEqual({ to: 1 });
    expect(step(key('x'), 1)).toEqual({ to: null });
    // The miss ended "chx": "d" alone lands on date.
    expect(step(key('d'), 1)).toEqual({ to: 3 });
  });

  it('is required', () => {
    // Never called: `pnpm typecheck` is what runs these lines.
    const unwritten = () => {
      // @ts-expect-error: the window has no default.
      useTypeAhead();
      // @ts-expect-error: the window has no default.
      useTypeAhead({ now: Date.now });
    };
    expect(unwritten).toBeTypeOf('function');
  });
});

/**
 * ⚠️ A `focus` names a row only as an integer index into `names`. After a filter, `indexOf` answers
 * -1 for a row no longer in the list, and an old index can point past a shrunk list's end.
 */
describe('a focus that names no row', () => {
  const FRUIT = ['apple', 'cherry', 'citrus', 'date'];

  /** Types `keys` over `names` with the same `focus` on every key, answering each `to`. */
  const typed = (keys: string[], focus: number | null, names = FRUIT) => {
    const { step } = setup(names);
    return keys.map((k) => step(key(k), focus)?.to);
  };

  /**
   * Row 0 matches `c`, so a search that starts anywhere but the top misses it — including one from
   * `names.length`, which wraps to row 1.
   */
  it('is searched from the top, as no focus is, by every type-ahead key', () => {
    const names = ['cherry', 'apple', 'citrus', 'date'];
    const stale = [-1, names.length, names.length + 5, 1.5, Number.NaN];
    for (const keys of [['c'], ['c', 'c'], ['c', 'i'], ['c', 'h']]) {
      for (const focus of stale) {
        expect(typed(keys, focus, names), `${keys.join('')} from ${focus}`).toEqual(
          typed(keys, null, names),
        );
      }
    }
  });

  it('⚠️ narrowing from -1 lands on citrus rather than throwing', () => {
    expect(typed(['c', 'i'], -1)).toEqual([1, 2]);
  });

  it('⚠️ a fresh letter from past the end lands on the first match', () => {
    expect(typed(['c'], 9)).toEqual([1]);
  });
});
