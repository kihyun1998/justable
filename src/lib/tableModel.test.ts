/**
 * The model against a spec that is not the Explorer's, so nothing here holds only because of one
 * consumer's columns.
 */
import { describe, expect, it } from 'vitest';

import { createTableModel } from './tableModel.js';
import type { ColumnLayout, ColumnSpec } from '../types.js';

interface Task {
  title: string;
  due: number | null;
  owner: string;
}

type Key = 'title' | 'due' | 'owner';
type Hideable = Exclude<Key, 'title'>;

const SPEC: readonly ColumnSpec<Task, Key>[] = [
  {
    key: 'title',
    defaultWidth: 200,
    minWidth: 100,
    maxWidth: 400,
    hideable: false,
    movable: false,
    firstSortDesc: false,
    compare: (a, b) => a.title.localeCompare(b.title),
  },
  {
    key: 'due',
    defaultWidth: 90,
    minWidth: 40,
    maxWidth: 300,
    hideable: true,
    movable: true,
    firstSortDesc: true,
    compare: (a, b) => (a.due ?? -1) - (b.due ?? -1),
  },
  {
    key: 'owner',
    defaultWidth: 120,
    minWidth: 40,
    maxWidth: 300,
    hideable: true,
    movable: true,
    firstSortDesc: false,
    compare: (a, b) => a.owner.localeCompare(b.owner),
  },
];

const model = createTableModel<Task, Key, Hideable>(SPEC);
const EMPTY: ColumnLayout<Key, Hideable> = { widths: {}, hidden: [] };
const task = (title: string, due: number | null, owner: string): Task => ({ title, due, owner });

describe('widths', () => {
  it('an untouched column reads its default', () => {
    expect(model.columnWidth(EMPTY, 'due')).toBe(90);
  });

  it('each column clamps to its own bounds', () => {
    expect(model.clampWidth(0, 'title')).toBe(100);
    expect(model.clampWidth(0, 'due')).toBe(40);
    expect(model.clampWidth(9999, 'owner')).toBe(300);
  });

  it('a stored width is clamped on write and on read', () => {
    expect(model.withWidth(EMPTY, 'due', 5).widths.due).toBe(40);
    expect(model.columnWidth({ widths: { due: 5 }, hidden: [] }, 'due')).toBe(40);
  });

  it('a non-number from a file reads as the default', () => {
    expect(model.columnWidth({ widths: { due: Number.NaN }, hidden: [] }, 'due')).toBe(90);
  });

  it('a write keeps the fields it does not own', () => {
    const layout = { widths: {}, hidden: ['owner' as const], extra: 1 };
    expect(model.withWidth(layout, 'due', 60)).toEqual({
      widths: { due: 60 },
      hidden: ['owner'],
      extra: 1,
    });
  });
});

describe('hiding', () => {
  it('toggles, and a hidden column leaves the drawn list and the template', () => {
    const hidden = model.toggleHidden(EMPTY, 'due');
    expect(model.isHidden(hidden, 'due')).toBe(true);
    expect(model.visibleColumns(hidden)).toEqual(['title', 'owner']);
    expect(model.gridTemplate(hidden)).toBe('200px 120px minmax(0,1fr)');
    expect(model.isHidden(model.toggleHidden(hidden, 'due'), 'due')).toBe(false);
  });

  it('a column the spec does not let hide is drawn even when the layout lists it', () => {
    const forced = { widths: {}, hidden: ['title'] } as unknown as ColumnLayout<Key, Hideable>;
    expect(model.visibleColumns(forced)).toEqual(['title', 'due', 'owner']);
  });

  it('the columns keep spec order', () => {
    const layout = model.toggleHidden(model.toggleHidden(EMPTY, 'owner'), 'due');
    expect(model.visibleColumns(model.toggleHidden(layout, 'owner'))).toEqual(['title', 'owner']);
  });
});

describe('the grid template', () => {
  it('is one px track per drawn column and then a filler that is not a column', () => {
    expect(model.gridTemplate(EMPTY)).toBe('200px 90px 120px minmax(0,1fr)');
  });
});

describe('the column order', () => {
  it('an absent order is spec order', () => {
    expect(model.visibleColumns(EMPTY)).toEqual(['title', 'due', 'owner']);
  });

  it('the drawn columns and the template follow the order', () => {
    const layout = { ...EMPTY, order: ['title', 'owner', 'due'] as Key[] };
    expect(model.visibleColumns(layout)).toEqual(['title', 'owner', 'due']);
    expect(model.gridTemplate(layout)).toBe('200px 120px 90px minmax(0,1fr)');
  });

  it('a hidden column keeps its place, so showing it again puts it back there', () => {
    const moved = model.withOrder(EMPTY, 'owner', 'due');
    const hidden = model.toggleHidden(moved, 'owner');
    expect(model.visibleColumns(hidden)).toEqual(['title', 'due']);
    expect(model.visibleColumns(model.toggleHidden(hidden, 'owner'))).toEqual([
      'title',
      'owner',
      'due',
    ]);
  });

  it('a spec key the order lacks comes after the listed ones; an order key the spec lacks is ignored', () => {
    const layout = { ...EMPTY, order: ['gone', 'owner'] as unknown as Key[] };
    expect(model.visibleColumns(layout)).toEqual(['title', 'owner', 'due']);
  });

  it('a key the order lists twice is placed at its first', () => {
    const layout = { ...EMPTY, order: ['owner', 'due', 'owner'] as Key[] };
    expect(model.visibleColumns(layout)).toEqual(['title', 'owner', 'due']);
  });

  it('a stored order cannot carry a movable column past an unmovable one', () => {
    const layout = { ...EMPTY, order: ['owner', 'due', 'title'] as Key[] };
    expect(model.visibleColumns(layout)).toEqual(['title', 'owner', 'due']);
  });

  it('withOrder moves a column before another, or to the end', () => {
    expect(model.visibleColumns(model.withOrder(EMPTY, 'owner', 'due'))).toEqual([
      'title',
      'owner',
      'due',
    ]);
    const swapped = { ...EMPTY, order: ['title', 'owner', 'due'] as Key[] };
    expect(model.visibleColumns(model.withOrder(swapped, 'owner', null))).toEqual([
      'title',
      'due',
      'owner',
    ]);
  });

  it('an order equal to spec order is dropped, and the rest of the layout kept', () => {
    const layout = { ...EMPTY, order: ['title', 'owner', 'due'] as Key[], extra: 1 };
    expect(model.withOrder(layout, 'owner', null)).toEqual({ ...EMPTY, extra: 1 });
  });

  it('refuses a move of an unmovable column, or past one', () => {
    expect(model.withOrder(EMPTY, 'title', null)).toBe(EMPTY);
    expect(model.withOrder(EMPTY, 'title', 'due')).toBe(EMPTY);
    expect(model.withOrder(EMPTY, 'due', 'title')).toBe(EMPTY);
  });
});

describe('the column order around a pin in the middle', () => {
  type P = 'a' | 'b' | 'pin' | 'c' | 'd';
  const column = (key: P, movable: boolean): ColumnSpec<Task, P> => ({
    key,
    defaultWidth: 10,
    minWidth: 10,
    maxWidth: 10,
    hideable: true,
    movable,
    firstSortDesc: false,
    compare: () => 0,
  });
  const pinned = createTableModel<Task, P>([
    column('a', true),
    column('b', true),
    column('pin', false),
    column('c', true),
    column('d', true),
  ]);
  const NONE: ColumnLayout<P> = { widths: {}, hidden: [] };

  it('moves within a side of the pin', () => {
    expect(pinned.visibleColumns(pinned.withOrder(NONE, 'b', 'a'))).toEqual([
      'b',
      'a',
      'pin',
      'c',
      'd',
    ]);
    expect(pinned.visibleColumns(pinned.withOrder(NONE, 'a', 'pin'))).toEqual([
      'b',
      'a',
      'pin',
      'c',
      'd',
    ]);
    expect(pinned.visibleColumns(pinned.withOrder(NONE, 'c', null))).toEqual([
      'a',
      'b',
      'pin',
      'd',
      'c',
    ]);
  });

  it('refuses a move across the pin, either way', () => {
    expect(pinned.withOrder(NONE, 'a', null)).toBe(NONE);
    expect(pinned.withOrder(NONE, 'a', 'd')).toBe(NONE);
    expect(pinned.withOrder(NONE, 'd', 'a')).toBe(NONE);
    expect(pinned.withOrder(NONE, 'c', 'pin')).toBe(NONE);
  });

  it('a stored order keeps each column on its own side of the pin', () => {
    const layout = { ...NONE, order: ['d', 'c', 'pin', 'b', 'a'] as P[] };
    expect(pinned.visibleColumns(layout)).toEqual(['b', 'a', 'pin', 'd', 'c']);
  });
});

describe('where a column may land', () => {
  it('the full order lists hidden columns too, in their places', () => {
    const layout = model.toggleHidden(model.withOrder(EMPTY, 'owner', 'due'), 'owner');
    expect(model.columnOrder(layout)).toEqual(['title', 'owner', 'due']);
    expect(model.visibleColumns(layout)).toEqual(['title', 'due']);
  });

  it('answers per drawn slot: the key to report there, or nothing where the move is refused', () => {
    expect(model.moveTargets(EMPTY, 'owner')).toEqual([undefined, 'due', undefined, null]);
    expect(model.moveTargets(EMPTY, 'title')).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe('where a column may land around a hidden pin', () => {
  type P = 'a' | 'b' | 'pin' | 'c' | 'd';
  const column = (key: P, movable: boolean): ColumnSpec<Task, P> => ({
    key,
    defaultWidth: 10,
    minWidth: 10,
    maxWidth: 10,
    hideable: true,
    movable,
    firstSortDesc: false,
    compare: () => 0,
  });
  const pinned = createTableModel<Task, P>([
    column('a', true),
    column('b', true),
    column('pin', false),
    column('c', true),
    column('d', true),
  ]);
  const HIDDEN: ColumnLayout<P> = { widths: {}, hidden: ['pin'] };

  it('the slot after the run reports the hidden pin, and no slot past it is offered', () => {
    expect(pinned.visibleColumns(HIDDEN)).toEqual(['a', 'b', 'c', 'd']);
    expect(pinned.moveTargets(HIDDEN, 'a')).toEqual([undefined, 'b', 'pin', undefined, undefined]);
    expect(pinned.moveTargets(HIDDEN, 'd')).toEqual([undefined, undefined, 'c', undefined, null]);
  });

  it('a slot with a hidden movable column before its drawn one lands next to the drawn one', () => {
    const layout: ColumnLayout<P> = { widths: {}, hidden: ['b'] };
    expect(pinned.moveTargets(layout, 'a')).toEqual([undefined, 'pin', undefined, undefined, undefined]);
  });

  it('every slot it offers is a move withOrder makes', () => {
    for (const layout of [HIDDEN, { ...HIDDEN, order: ['b', 'a', 'pin', 'd', 'c'] as P[] }]) {
      for (const key of ['a', 'b', 'c', 'd'] as const) {
        for (const before of pinned.moveTargets(layout, key)) {
          if (before === undefined) continue;
          const moved = pinned.withOrder(layout, key, before);
          const at = pinned.columnOrder(moved).indexOf(key);
          expect(pinned.columnOrder(moved)[at + 1] ?? null, `${key} before ${before}`).toBe(before);
        }
      }
    }
  });
});

describe('the sort cycle', () => {
  it('starts in the column’s first direction', () => {
    expect(model.nextSort(undefined, 'title')).toEqual({ key: 'title', desc: false });
    expect(model.nextSort(undefined, 'due')).toEqual({ key: 'due', desc: true });
  });

  it('flips, then returns to no sort — absence, not a value', () => {
    const first = model.nextSort(undefined, 'due');
    const second = model.nextSort(first, 'due');
    expect(second).toEqual({ key: 'due', desc: false });
    expect(model.nextSort(second, 'due')).toBeUndefined();
  });

  it('pressing another column starts that one fresh', () => {
    expect(model.nextSort({ key: 'due', desc: false }, 'owner')).toEqual({
      key: 'owner',
      desc: false,
    });
  });
});

describe('sortRows', () => {
  const rows = [task('c', 2, 'x'), task('a', null, 'y'), task('b', 2, 'x')];

  it('no sort is a copy in input order', () => {
    const out = model.sortRows(rows, undefined);
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });

  it('sorts by the column’s comparator in the asked direction', () => {
    expect(model.sortRows(rows, { key: 'title', desc: true }).map((r) => r.title)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  it('ties fall to the tie-break, in its own direction', () => {
    const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);
    expect(model.sortRows(rows, { key: 'due', desc: true }, byTitle).map((r) => r.title)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('leaves the input alone', () => {
    const before = [...rows];
    model.sortRows(rows, { key: 'owner', desc: false });
    expect(rows).toEqual(before);
  });
});

describe('an unknown column', () => {
  it('throws rather than drawing a width of undefined', () => {
    expect(() => model.clampWidth(10, 'nope' as Key)).toThrow(/unknown column/);
  });

  it('withOrder throws on either key', () => {
    expect(() => model.withOrder(EMPTY, 'nope' as Key, null)).toThrow(/unknown column/);
    expect(() => model.withOrder(EMPTY, 'due', 'nope' as Key)).toThrow(/unknown column/);
  });
});
