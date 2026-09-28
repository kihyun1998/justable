/**
 * The model against a spec that is not the Explorer's, so nothing here holds only because of one
 * consumer's columns. The Explorer's own rules are `blocks/explorer/lib/explorerTable.test.ts`.
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
    firstSortDesc: false,
    compare: (a, b) => a.title.localeCompare(b.title),
  },
  {
    key: 'due',
    defaultWidth: 90,
    minWidth: 40,
    maxWidth: 300,
    hideable: true,
    firstSortDesc: true,
    compare: (a, b) => (a.due ?? -1) - (b.due ?? -1),
  },
  {
    key: 'owner',
    defaultWidth: 120,
    minWidth: 40,
    maxWidth: 300,
    hideable: true,
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
});
