// @vitest-environment jsdom
/**
 * The keyboard hook against a plain list of names, with no DOM beyond the hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TableMovement } from '../lib/tableKeyboard.js';
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
    typeAhead: (e: ReturnType<typeof key>, focus: number | null) =>
      result.current.typeAhead(e, { focus, names }),
    move: (movement: TableMovement, focus: number | null) =>
      result.current.move(movement, { focus, total: names.length }),
    link: result.current.link,
    end: () => result.current.end(),
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('move', () => {
  it('answers where the row goes', () => {
    const { move } = setup();
    expect(move('down', 2)).toBe(3);
    expect(move('up', 2)).toBe(1);
    expect(move('first', 5)).toBe(0);
    expect(move('last', null)).toBe(NAMES.length - 1);
  });

  it('pages by the rows the grid measured, and by one before it has', () => {
    const { move, link } = setup();
    expect(move('pageDown', 0)).toBe(1);
    link.rowsPerPage = 3;
    expect(move('pageDown', 0)).toBe(3);
    expect(move('pageUp', 5)).toBe(2);
  });

  it('an empty list moves nowhere', () => {
    const { move } = setup({ names: [] });
    expect(move('down', null)).toBeNull();
  });

  it('a name that is not a movement goes nowhere and leaves a running query alone', () => {
    const { typeAhead, move } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    expect(move('ArrowDown' as TableMovement, 2)).toBeNull();
    // Still running: "ci" narrows to citrus.
    expect(typeAhead(key('i'), 2)).toEqual({ to: 3 });
  });

  it('ends a running query, so the next letter starts a new one', () => {
    const { typeAhead, move } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    expect(move('down', 2)).toBe(3);
    // "d" alone lands on date; "cd" would match nothing.
    expect(typeAhead(key('d'), 3)).toEqual({ to: 4 });
  });
});

describe('type-ahead', () => {
  it('a letter lands on the first name starting with it and claims the event', () => {
    const { typeAhead } = setup();
    const e = key('c');
    expect(typeAhead(e, null)).toEqual({ to: 2 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('a fresh letter searches after the focused row, as useTypeAhead does', () => {
    const { typeAhead } = setup();
    expect(typeAhead(key('c'), 2)).toEqual({ to: 3 });
  });

  it('the same letter again walks the matches', () => {
    const { typeAhead } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    expect(typeAhead(key('c'), 2)).toEqual({ to: 3 });
  });

  it('another letter narrows from the current row, not after it', () => {
    const { typeAhead } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    expect(typeAhead(key('i'), 2)).toEqual({ to: 3 });
  });

  it('⚠️ a pause longer than the window starts a new query', () => {
    const { typeAhead, advance } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    advance(WINDOW + 1);
    expect(typeAhead(key('b'), 2)).toEqual({ to: 1 });
  });

  it('⚠️ end() ends the query, so the next letter after a list is replaced starts a new one', () => {
    let clock = 1_000;
    const { result } = renderHook(() => useTableKeyboard({ windowMs: WINDOW, now: () => clock }));
    const folder = ['bin', 'docs', 'src'];
    expect(result.current.typeAhead(key('d'), { focus: null, names: folder })).toEqual({ to: 1 });
    result.current.end();
    clock += 1;
    // "b" alone lands on b.md; "db" would match nothing.
    const docs = ['a.md', 'b.md', 'c.md', 'd.md'];
    expect(result.current.typeAhead(key('b'), { focus: null, names: docs })).toEqual({ to: 1 });
  });

  it('end() stops a running query, so a space after it is the consumer’s', () => {
    const { typeAhead, end } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    end();
    const e = key(' ');
    expect(typeAhead(e, 2)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('a miss clears the query, so the next letter starts over', () => {
    const { typeAhead } = setup();
    expect(typeAhead(key('c'), null)).toEqual({ to: 2 });
    expect(typeAhead(key('x'), 2)).toEqual({ to: null });
    // "d" alone lands on date; "cxd" would match nothing.
    expect(typeAhead(key('d'), 2)).toEqual({ to: 4 });
  });

  it('within the window the query extends instead', () => {
    const { typeAhead, advance } = setup();
    typeAhead(key('c'), null);
    advance(WINDOW - 1);
    // "cb" matches nothing.
    expect(typeAhead(key('b'), 2)).toEqual({ to: null });
  });

  it('⚠️ a type-ahead key that matches nothing is still answered, and the event is left alone', () => {
    const { typeAhead } = setup();
    const e = key('z');
    expect(typeAhead(e, null)).toEqual({ to: null });
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('a letter with Ctrl, Meta or Alt is not type-ahead', () => {
    const { typeAhead } = setup();
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(typeAhead(key('c', { [mod]: true }), null), mod).toBeNull();
    }
  });

  it('⚠️ an arrow key reaches nothing: no answer, the event untouched', () => {
    const { typeAhead } = setup();
    for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']) {
      const e = key(k);
      expect(typeAhead(e, 2), k).toBeNull();
      expect(e.preventDefault, k).not.toHaveBeenCalled();
    }
  });

  it('a named key is not type-ahead', () => {
    const { typeAhead } = setup();
    expect(typeAhead(key('Enter'), 0)).toBeNull();
  });
});

describe('the window', () => {
  /** `c` lands on cherry; `d` after it is "cd", a miss, inside the window, and date past it. */
  const afterPause = (windowMs: number, pause: number) => {
    const { typeAhead, advance } = setup({ windowMs });
    typeAhead(key('c'), null);
    advance(pause);
    return typeAhead(key('d'), 2);
  };

  for (const windowMs of [300, 1000]) {
    it(`⚠️ is the consumer’s: with ${windowMs} ms, 1 ms inside extends the query, 1 ms past starts one`, () => {
      expect(afterPause(windowMs, windowMs - 1)).toEqual({ to: null });
      expect(afterPause(windowMs, windowMs + 1)).toEqual({ to: 4 });
    });
  }

  it('reaches the type-ahead at its edges too: 0 and NaN keep no query open, Infinity never pauses', () => {
    expect(afterPause(0, 0)).toEqual({ to: 4 });
    expect(afterPause(Number.NaN, 0)).toEqual({ to: 4 });
    expect(afterPause(Infinity, 1e9)).toEqual({ to: null });
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
  function type(typeAhead: ReturnType<typeof setup>['typeAhead'], keys: string[]) {
    let focus: number | null = null;
    let last = null;
    for (const k of keys) {
      last = typeAhead(key(k), focus);
      if (last?.to != null) focus = last.to;
    }
    return last;
  }

  it('⚠️ typed inside a running query, it is part of the query', () => {
    const { typeAhead } = setup({ names: FOLDERS });
    expect(type(typeAhead, ['n', 'e', 'w'])).toEqual({ to: 0 });
    const e = key(' ');
    expect(typeAhead(e, 0)).toEqual({ to: 1 });
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(typeAhead(key('f'), 1)).toEqual({ to: 1 });
  });

  it('with Shift held inside a running query, it is part of the query too', () => {
    const { typeAhead } = setup({ names: FOLDERS });
    type(typeAhead, ['n', 'e', 'w']);
    expect(typeAhead(key(' ', { shiftKey: true }), 0)).toEqual({ to: 1 });
  });

  it('⚠️ as the first key, it is the consumer’s: no answer, the event untouched', () => {
    const { typeAhead } = setup({ names: FOLDERS });
    const e = key(' ');
    expect(typeAhead(e, 0)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('⚠️ after a pause longer than the window, it is the consumer’s', () => {
    const { typeAhead, advance } = setup({ names: FOLDERS });
    type(typeAhead, ['n', 'e', 'w']);
    advance(WINDOW + 1);
    const e = key(' ');
    expect(typeAhead(e, 0)).toBeNull();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('⚠️ after any movement inside the window, it is the consumer’s', () => {
    for (const movement of ['down', 'up', 'first', 'last', 'pageDown', 'pageUp'] as const) {
      const { typeAhead, move } = setup({ names: FOLDERS });
      typeAhead(key('n'), null);
      expect(move(movement, 0), movement).not.toBeNull();
      const e = key(' ');
      expect(typeAhead(e, 0), movement).toBeNull();
      expect(e.preventDefault, movement).not.toHaveBeenCalled();
    }
  });

  it('as the first key on a clock that starts near zero, it is still the consumer’s', () => {
    const { typeAhead } = setup({ names: FOLDERS, start: 0 });
    expect(typeAhead(key(' '), null)).toBeNull();
  });
});

describe('a focus that names no row', () => {
  it('type-ahead searches from the top, as useTypeAhead does', () => {
    const { typeAhead } = setup();
    expect(typeAhead(key('c'), -1)).toEqual({ to: 2 });
    expect(typeAhead(key('i'), -1)).toEqual({ to: 3 });
  });

  it('move clamps an integer and takes a non-integer as no focus', () => {
    const { move } = setup();
    expect(move('up', 20)).toBe(NAMES.length - 1);
    expect(move('down', 1.5)).toBe(0);
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

describe('end', () => {
  it('is one function for the hook’s life, so an effect can depend on it', () => {
    const { result, rerender } = renderHook(() => useTableKeyboard({ windowMs: WINDOW }));
    const first = result.current.end;
    expect(first).toBeTypeOf('function');
    rerender();
    expect(result.current.end).toBe(first);
  });
});

describe('the surface', () => {
  it('has no key-reading step: which key asks for which movement is the consumer’s', () => {
    // Never called: `pnpm typecheck` is what runs these lines.
    const unwritten = () => {
      const { result } = renderHook(() => useTableKeyboard({ windowMs: WINDOW }));
      // @ts-expect-error: the hook reads no key to move the row.
      result.current.step;
    };
    expect(unwritten).toBeTypeOf('function');
  });
});

describe('move and typeAhead', () => {
  it('are each one function for the hook’s life, so a consumer can register them once', () => {
    const { result, rerender } = renderHook(() => useTableKeyboard({ windowMs: WINDOW }));
    const { move, typeAhead } = result.current;
    rerender();
    expect(result.current.move).toBe(move);
    expect(result.current.typeAhead).toBe(typeAhead);
  });
});
