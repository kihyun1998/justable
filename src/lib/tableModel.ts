/**
 * The table's pure decisions — widths, hiding, the grid template and sorting — bound to one spec.
 */
import type { ColumnLayout, ColumnSpec, TableSort } from '../types.js';

export interface TableModel<Row, K extends string, H extends K> {
  clampWidth: (px: number, key: K) => number;
  columnWidth: (layout: ColumnLayout<K, H>, key: K) => number;
  withWidth: <L extends ColumnLayout<K, H>>(layout: L, key: K, px: number) => L;
  isHidden: (layout: ColumnLayout<K, H>, key: H) => boolean;
  toggleHidden: <L extends ColumnLayout<K, H>>(layout: L, key: H) => L;
  /** The drawn columns, in spec order. */
  visibleColumns: (layout: ColumnLayout<K, H>) => K[];
  /** `grid-template-columns`: one px track per drawn column, then a filler that is not a column. */
  gridTemplate: (layout: ColumnLayout<K, H>) => string;
  /** One header press: first direction → the other → no sort. */
  nextSort: (current: TableSort<K> | undefined, key: K) => TableSort<K> | undefined;
  /** A sorted copy; no sort keeps the input order. Ties fall to `tieBreak`. */
  sortRows: (
    rows: readonly Row[],
    sort: TableSort<K> | undefined,
    tieBreak?: (a: Row, b: Row) => number,
  ) => Row[];
}

export function createTableModel<Row, K extends string, H extends K = K>(
  spec: readonly ColumnSpec<Row, K>[],
): TableModel<Row, K, H> {
  const byKey = new Map(spec.map((column) => [column.key, column]));
  const column = (key: K): ColumnSpec<Row, K> => {
    const found = byKey.get(key);
    if (!found) throw new Error(`unknown column: ${key}`);
    return found;
  };

  const clampWidth = (px: number, key: K) => {
    const { minWidth, maxWidth } = column(key);
    return Math.min(maxWidth, Math.max(minWidth, Math.round(px)));
  };

  const columnWidth = (layout: ColumnLayout<K, H>, key: K) => {
    const raw = layout.widths[key];
    if (raw === undefined || !Number.isFinite(raw)) return column(key).defaultWidth;
    return clampWidth(raw, key);
  };

  const hiddenHas = (layout: ColumnLayout<K, H>, key: K) =>
    (layout.hidden as readonly K[]).includes(key);

  const visibleColumns = (layout: ColumnLayout<K, H>) =>
    spec.filter((c) => !c.hideable || !hiddenHas(layout, c.key)).map((c) => c.key);

  return {
    clampWidth,
    columnWidth,
    withWidth: (layout, key, px) => ({
      ...layout,
      widths: { ...layout.widths, [key]: clampWidth(px, key) },
    }),
    isHidden: (layout, key) => hiddenHas(layout, key),
    toggleHidden: (layout, key) => ({
      ...layout,
      hidden: hiddenHas(layout, key)
        ? layout.hidden.filter((k) => k !== key)
        : [...layout.hidden, key],
    }),
    visibleColumns,
    gridTemplate: (layout) =>
      [
        ...visibleColumns(layout).map((key) => `${columnWidth(layout, key)}px`),
        'minmax(0,1fr)',
      ].join(' '),
    nextSort: (current, key) => {
      const first = column(key).firstSortDesc;
      if (current?.key !== key) return { key, desc: first };
      if (current.desc !== first) return undefined;
      return { key, desc: !current.desc };
    },
    sortRows: (rows, sort, tieBreak) => {
      if (!sort) return [...rows];
      const { compare } = column(sort.key);
      const dir = sort.desc ? -1 : 1;
      return [...rows].sort((a, b) => dir * compare(a, b) || (tieBreak?.(a, b) ?? 0));
    },
  };
}
