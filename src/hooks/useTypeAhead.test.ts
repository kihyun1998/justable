// @vitest-environment jsdom
/**
 * Type-ahead on its own, for a list whose movement is not the table's.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTypeAhead } from './useTypeAhead.js';
import { TYPE_AHEAD_MS } from '../lib/tableKeyboard.js';

const NAMES = ['apple', 'banana', 'cherry', 'citrus', 'date', 'news.txt', 'new folder'];

function key(k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>> = {}) {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods, preventDefault: vi.fn() };
}

function setup() {
  let clock = 1_000;
  const { result } = renderHook(() => useTypeAhead({ now: () => clock }));
  return {
    step: (e: ReturnType<typeof key>, focus: number | null) =>
      result.current.step(e, { focus, names: NAMES }),
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
    advance(TYPE_AHEAD_MS + 1);
    expect(step(key('b'), 2)).toEqual({ to: 1 });
  });
});
