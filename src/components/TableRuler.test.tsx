// @vitest-environment jsdom
/**
 * What jsdom can check about the ruler: its shape, and — with `getBoundingClientRect` stubbed — what
 * `measure` and `measureAll` answer from the widths read. Where real widths are checked:
 * `docs/map/territory/verification-gates.md`.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TableRuler } from './TableRuler.js';
import { useColumnAutoFit } from '../hooks/useColumnAutoFit.js';

afterEach(cleanup);

const ROWS = ['alpha', 'beta', 'gamma'];

describe('TableRuler', () => {
  it('draws the one column it measures, with a cell per row', () => {
    const { container } = render(<TableRuler column="name" rows={ROWS} cell={(row) => row} />);
    const groups = [...container.querySelectorAll('[data-table-ruler]')];
    expect(groups.map((g) => g.getAttribute('data-table-ruler'))).toEqual(['name']);
    expect(groups[0]!.children).toHaveLength(ROWS.length);
  });

  it('draws a group per column when given several, each with a cell per row, in order', () => {
    const { container } = render(<TableRuler column={['name', 'kind']} rows={ROWS} cell={(row, key) => `${key}:${row}`} />);
    const groups = [...container.querySelectorAll('[data-table-ruler]')];
    expect(groups.map((g) => g.getAttribute('data-table-ruler'))).toEqual(['name', 'kind']);
    expect(groups.map((g) => g.children.length)).toEqual([ROWS.length, ROWS.length]);
    expect(groups[1]!.children[0]!.textContent).toBe('kind:alpha');
  });

  /**
   * RTL's text queries do not skip `aria-hidden` or `inert`, so a ruler left mounted doubles every
   * row's text.
   */
  it('⚠️ a mounted ruler is found by text queries — so it must not stay mounted', () => {
    render(<TableRuler column="name" rows={ROWS} cell={(row) => row} />);
    expect(screen.getAllByText('alpha').length).toBeGreaterThan(0);
  });
});

describe('useColumnAutoFit', () => {
  it('mounts nothing until asked, and nothing after', () => {
    const { result } = renderHook(() => useColumnAutoFit<'name'>());
    expect(result.current.measuring).toBeNull();
    act(() => {
      result.current.measure('name');
    });
    expect(result.current.measuring).toBeNull();
  });

  it('answers null when nothing measurable was drawn, never a width of zero', () => {
    const { result } = renderHook(() => useColumnAutoFit<'name'>());
    let px: number | null = 0;
    act(() => {
      px = result.current.measure('name');
    });
    expect(px).toBeNull();
  });
});

describe('useColumnAutoFit measureAll', () => {
  type Key = 'name' | 'kind' | 'empty';
  /** A ruler cell is 7.3px per character of its text; anything else is 0. */
  const PX_PER_CHAR = 7.3;
  const realRect = HTMLElement.prototype.getBoundingClientRect;
  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const inRuler = this.parentElement?.hasAttribute('data-table-ruler') ?? false;
      const width = inRuler ? (this.textContent?.length ?? 0) * PX_PER_CHAR : 0;
      return { width, height: 0, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 0, toJSON: () => ({}) };
    };
  });
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = realRect;
  });

  /** A consumer wired as the README says, counting how often its ruler mounts and its groups. */
  function harness(rows: readonly string[]) {
    const seen: { fit?: ReturnType<typeof useColumnAutoFit<Key>>; mounts: number; groups: number } = {
      mounts: 0,
      groups: 0,
    };
    function Consumer() {
      const fit = useColumnAutoFit<Key>();
      seen.fit = fit;
      return fit.measuring === null ? null : (
        <TableRuler
          ref={(el) => {
            if (el) {
              seen.mounts++;
              seen.groups = el.children.length;
            }
            fit.rulerRef.current = el;
          }}
          column={fit.measuring}
          rows={rows}
          cell={(row, key) => (key === 'empty' ? '' : key === 'kind' ? `${row}-file` : row)}
        />
      );
    }
    render(<Consumer />);
    return seen;
  }

  it('answers every requested column from one mount of the ruler, and leaves nothing mounted', () => {
    const seen = harness(['alpha', 'beta', 'gamma']);
    let px: Partial<Record<Key, number | null>> = {};
    act(() => {
      px = seen.fit!.measureAll(['name', 'kind']);
    });
    // 'alpha' is 5 chars → 36.5 → 37; 'alpha-file' is 10 chars → 73.
    expect(px).toEqual({ name: 37, kind: 73 });
    expect(seen.mounts).toBe(1);
    expect(seen.fit!.measuring).toBeNull();
    expect(document.querySelector('[data-table-ruler]')).toBeNull();
  });

  it('answers what measure answers, column by column', () => {
    const seen = harness(['alpha', 'beta', 'gamma']);
    let all: Partial<Record<Key, number | null>> = {};
    const one: Partial<Record<Key, number | null>> = {};
    act(() => {
      all = seen.fit!.measureAll(['name', 'kind', 'empty']);
    });
    for (const key of ['name', 'kind', 'empty'] as const) {
      act(() => {
        one[key] = seen.fit!.measure(key);
      });
    }
    expect(all).toEqual(one);
  });

  it('answers null for a column that measured nothing, never a width of zero', () => {
    const seen = harness(['alpha']);
    let px: Partial<Record<Key, number | null>> = {};
    act(() => {
      px = seen.fit!.measureAll(['empty', 'name']);
    });
    expect(px).toEqual({ empty: null, name: 37 });
  });

  it('answers null for every column of a table with no rows', () => {
    const seen = harness([]);
    let px: Partial<Record<Key, number | null>> = {};
    act(() => {
      px = seen.fit!.measureAll(['name', 'kind']);
    });
    expect(px).toEqual({ name: null, kind: null });
  });

  it('answers nothing and mounts nothing for no columns', () => {
    const seen = harness(['alpha']);
    let px: Partial<Record<Key, number | null>> | undefined;
    act(() => {
      px = seen.fit!.measureAll([]);
    });
    expect(px).toEqual({});
    expect(seen.mounts).toBe(0);
  });

  it('measures a key no CSS selector can quote', () => {
    const seen = harness(['alpha']);
    const odd = 'na"me]' as Key;
    let px: Partial<Record<Key, number | null>> = {};
    act(() => {
      px = seen.fit!.measureAll([odd, 'kind']);
    });
    expect(px).toEqual({ [odd]: 37, kind: 73 });
    expect(seen.fit!.measuring).toBeNull();
  });

  it('unmounts the ruler even when a read throws', () => {
    const seen = harness(['alpha']);
    HTMLElement.prototype.getBoundingClientRect = () => {
      throw new Error('layout gone');
    };
    act(() => {
      expect(() => seen.fit!.measureAll(['name'])).toThrow('layout gone');
    });
    expect(seen.fit!.measuring).toBeNull();
    expect(document.querySelector('[data-table-ruler]')).toBeNull();
    act(() => {
      expect(() => seen.fit!.measure('name')).toThrow('layout gone');
    });
    expect(seen.fit!.measuring).toBeNull();
    expect(document.querySelector('[data-table-ruler]')).toBeNull();
  });

  it('measures a key asked about twice once, in one group', () => {
    const seen = harness(['alpha']);
    let px: Partial<Record<Key, number | null>> = {};
    act(() => {
      px = seen.fit!.measureAll(['name', 'name', 'kind']);
    });
    expect(seen.groups).toBe(2);
    expect(px).toEqual({ name: 37, kind: 73 });
  });
});
