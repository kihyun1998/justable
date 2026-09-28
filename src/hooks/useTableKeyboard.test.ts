// @vitest-environment jsdom
/**
 * The keyboard hook against a plain list of names, with no DOM beyond the hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTableKeyboard } from './useTableKeyboard.js';
import { TYPE_AHEAD_MS } from '../lib/tableKeyboard.js';

const NAMES = ['apple', 'banana', 'cherry', 'citrus', 'date', 'elder', 'fig', 'grape'];

function key(k: string, mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey'>> = {}) {
  return {
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
    preventDefault: vi.fn(),
  };
}

function setup() {
  let clock = 1_000;
  const { result } = renderHook(() => useTableKeyboard({ now: () => clock }));
  return {
    step: (e: ReturnType<typeof key>, focus: number | null) =>
      result.current.step(e, { focus, names: NAMES }),
    link: result.current.link,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('movement keys', () => {
  it('answers where the row goes and claims the event', () => {
    const { step } = setup();
    const e = key('ArrowDown');
    expect(step(e, 2)).toEqual({ by: 'move', to: 3 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('pages by the rows the grid measured, and by one before it has', () => {
    const { step, link } = setup();
    expect(step(key('PageDown'), 0)).toEqual({ by: 'move', to: 1 });
    link.rowsPerPage = 3;
    expect(step(key('PageDown'), 0)).toEqual({ by: 'move', to: 3 });
    expect(step(key('PageUp'), 5)).toEqual({ by: 'move', to: 2 });
  });

  it('moves with a modifier held too — what a modifier means is the consumer’s', () => {
    const { step } = setup();
    expect(step(key('End', { ctrlKey: true }), null)).toEqual({ by: 'move', to: NAMES.length - 1 });
  });

  it('←/→ are not the table’s: no answer, the event untouched', () => {
    const { step } = setup();
    for (const k of ['ArrowLeft', 'ArrowRight']) {
      const e = key(k);
      expect(step(e, 2), k).toBeNull();
      expect(e.preventDefault).not.toHaveBeenCalled();
    }
  });

  it('an empty list moves nowhere', () => {
    const { result } = renderHook(() => useTableKeyboard());
    expect(result.current.step(key('ArrowDown'), { focus: null, names: [] })).toBeNull();
  });
});

describe('type-ahead', () => {
  it('a letter lands on the first name starting with it and claims the event', () => {
    const { step } = setup();
    const e = key('c');
    expect(step(e, null)).toEqual({ by: 'typeAhead', to: 2 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('the same letter again walks the matches', () => {
    const { step } = setup();
    expect(step(key('c'), null)).toEqual({ by: 'typeAhead', to: 2 });
    expect(step(key('c'), 2)).toEqual({ by: 'typeAhead', to: 3 });
  });

  it('another letter narrows from the current row, not after it', () => {
    const { step } = setup();
    expect(step(key('c'), null)).toEqual({ by: 'typeAhead', to: 2 });
    expect(step(key('i'), 2)).toEqual({ by: 'typeAhead', to: 3 });
  });

  it('⚠️ a pause longer than the window starts a new query', () => {
    const { step, advance } = setup();
    expect(step(key('c'), null)).toEqual({ by: 'typeAhead', to: 2 });
    advance(TYPE_AHEAD_MS + 1);
    expect(step(key('b'), 2)).toEqual({ by: 'typeAhead', to: 1 });
  });

  it('within the window the query extends instead', () => {
    const { step, advance } = setup();
    step(key('c'), null);
    advance(TYPE_AHEAD_MS - 1);
    // "cb" matches nothing.
    expect(step(key('b'), 2)).toEqual({ by: 'typeAhead', to: null });
  });

  it('⚠️ a type-ahead key that matches nothing is still answered, and the event is left alone', () => {
    const { step } = setup();
    const e = key('z');
    expect(step(e, null)).toEqual({ by: 'typeAhead', to: null });
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('a letter with Ctrl, Meta or Alt is not type-ahead', () => {
    const { step } = setup();
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(step(key('c', { [mod]: true }), null), mod).toBeNull();
    }
  });

  it('⚠️ a space is not type-ahead — it is left for the consumer', () => {
    const { step } = setup();
    const e = key(' ');
    expect(step(e, 0)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('a named key is not type-ahead', () => {
    const { step } = setup();
    expect(step(key('Enter'), 0)).toBeNull();
  });
});

describe('the link', () => {
  it('is one object for the hook’s life, so the grid can hold it', () => {
    const { result, rerender } = renderHook(() => useTableKeyboard());
    const first = result.current.link;
    rerender();
    expect(result.current.link).toBe(first);
  });
});
