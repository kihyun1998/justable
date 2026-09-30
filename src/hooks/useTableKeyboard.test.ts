// @vitest-environment jsdom
/**
 * The keyboard hook against a plain list of names, with no DOM beyond the hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTableKeyboard } from './useTableKeyboard.js';

/** The window most tests type within, in ms. */
const WINDOW = 500;

const NAMES = ['apple', 'banana', 'cherry', 'citrus', 'date', 'elder', 'fig', 'grape'];

function key(
  k: string,
  mods: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>> = {},
) {
  return {
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
    preventDefault: vi.fn(),
  };
}

function setup({
  names = NAMES,
  start = 1_000,
  windowMs = WINDOW,
}: { names?: readonly string[]; start?: number; windowMs?: number } = {}) {
  let clock = start;
  const { result } = renderHook(() => useTableKeyboard({ windowMs, now: () => clock }));
  return {
    step: (e: ReturnType<typeof key>, focus: number | null) =>
      result.current.step(e, { focus, names }),
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
    const { result } = renderHook(() => useTableKeyboard({ windowMs: WINDOW }));
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

  it('a fresh letter searches after the focused row, as useTypeAhead does', () => {
    const { step } = setup();
    expect(step(key('c'), 2)).toEqual({ by: 'typeAhead', to: 3 });
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
    advance(WINDOW + 1);
    expect(step(key('b'), 2)).toEqual({ by: 'typeAhead', to: 1 });
  });

  it('a movement key ends the query, so the next letter starts a new one', () => {
    const { step } = setup();
    expect(step(key('c'), null)).toEqual({ by: 'typeAhead', to: 2 });
    expect(step(key('ArrowDown'), 2)).toEqual({ by: 'move', to: 3 });
    // "d" alone lands on date; "cd" would match nothing.
    expect(step(key('d'), 3)).toEqual({ by: 'typeAhead', to: 4 });
  });

  it('a miss clears the query, so the next letter starts over', () => {
    const { step } = setup();
    expect(step(key('c'), null)).toEqual({ by: 'typeAhead', to: 2 });
    expect(step(key('x'), 2)).toEqual({ by: 'typeAhead', to: null });
    // "d" alone lands on date; "cxd" would match nothing.
    expect(step(key('d'), 2)).toEqual({ by: 'typeAhead', to: 4 });
  });

  it('within the window the query extends instead', () => {
    const { step, advance } = setup();
    step(key('c'), null);
    advance(WINDOW - 1);
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

  it('a named key is not type-ahead', () => {
    const { step } = setup();
    expect(step(key('Enter'), 0)).toBeNull();
  });
});

describe('the window', () => {
  /** `c` lands on cherry; `d` after it is "cd", a miss, inside the window, and date past it. */
  const afterPause = (windowMs: number, pause: number) => {
    const { step, advance } = setup({ windowMs });
    step(key('c'), null);
    advance(pause);
    return step(key('d'), 2);
  };

  for (const windowMs of [300, 1000]) {
    it(`⚠️ is the consumer’s: with ${windowMs} ms, 1 ms inside extends the query, 1 ms past starts one`, () => {
      expect(afterPause(windowMs, windowMs - 1)).toEqual({ by: 'typeAhead', to: null });
      expect(afterPause(windowMs, windowMs + 1)).toEqual({ by: 'typeAhead', to: 4 });
    });
  }

  it('reaches the type-ahead at its edges too: 0 and NaN keep no query open, Infinity never pauses', () => {
    expect(afterPause(0, 0)).toEqual({ by: 'typeAhead', to: 4 });
    expect(afterPause(Number.NaN, 0)).toEqual({ by: 'typeAhead', to: 4 });
    expect(afterPause(Infinity, 1e9)).toEqual({ by: 'typeAhead', to: null });
  });

  it('is required', () => {
    // Never called: `pnpm typecheck` is what runs these lines.
    const unwritten = () => {
      // @ts-expect-error: the window has no default.
      useTableKeyboard();
      // @ts-expect-error: the window has no default.
      useTableKeyboard({ now: Date.now });
    };
    expect(unwritten).toBeTypeOf('function');
  });
});

describe('a space', () => {
  /** "new" lands on `news.txt`; only a space kept in the query reaches `new folder`. */
  const FOLDERS = ['news.txt', 'new folder'];

  /** Types `keys` one after another inside the window, following focus like a consumer does. */
  function type(step: ReturnType<typeof setup>['step'], keys: string[]) {
    let focus: number | null = null;
    let last = null;
    for (const k of keys) {
      last = step(key(k), focus);
      if (last?.to != null) focus = last.to;
    }
    return last;
  }

  it('⚠️ typed inside a running query, it is part of the query', () => {
    const { step } = setup({ names: FOLDERS });
    expect(type(step, ['n', 'e', 'w'])).toEqual({ by: 'typeAhead', to: 0 });
    const e = key(' ');
    expect(step(e, 0)).toEqual({ by: 'typeAhead', to: 1 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(step(key('f'), 1)).toEqual({ by: 'typeAhead', to: 1 });
  });

  it('with Shift held inside a running query, it is part of the query too', () => {
    const { step } = setup({ names: FOLDERS });
    type(step, ['n', 'e', 'w']);
    expect(step(key(' ', { shiftKey: true }), 0)).toEqual({ by: 'typeAhead', to: 1 });
  });

  it('⚠️ as the first key, it is the consumer’s: no answer, the event untouched', () => {
    const { step } = setup({ names: FOLDERS });
    const e = key(' ');
    expect(step(e, 0)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('⚠️ after a pause longer than the window, it is the consumer’s', () => {
    const { step, advance } = setup({ names: FOLDERS });
    type(step, ['n', 'e', 'w']);
    advance(WINDOW + 1);
    const e = key(' ');
    expect(step(e, 0)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('⚠️ after any movement key inside the window, it is the consumer’s', () => {
    for (const move of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']) {
      const { step } = setup({ names: FOLDERS });
      step(key('n'), null);
      expect(step(key(move), 0)?.by, move).toBe('move');
      const e = key(' ');
      expect(step(e, 0), move).toBeNull();
      expect(e.preventDefault, move).not.toHaveBeenCalled();
    }
  });

  it('as the first key on a clock that starts near zero, it is still the consumer’s', () => {
    const { step } = setup({ names: FOLDERS, start: 0 });
    expect(step(key(' '), null)).toBeNull();
  });
});

describe('the link', () => {
  it('is one object for the hook’s life, so the grid can hold it', () => {
    const { result, rerender } = renderHook(() => useTableKeyboard({ windowMs: WINDOW }));
    const first = result.current.link;
    rerender();
    expect(result.current.link).toBe(first);
  });
});
