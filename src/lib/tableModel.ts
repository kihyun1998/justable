/**
 * The table's pure decisions — widths, hiding, order, the grid template and sorting — bound to one spec.
 */
import type { ColumnLayout, ColumnSpec, TableSort } from '../types.js';

export interface TableModel<Row, K extends string, H extends K> {
  clampWidth: (px: number, key: K) => number;
  columnWidth: (layout: ColumnLayout<K, H>, key: K) => number;
  withWidth: <L extends ColumnLayout<K, H>>(layout: L, key: K, px: number) => L;
  isHidden: (layout: ColumnLayout<K, H>, key: H) => boolean;
  toggleHidden: <L extends ColumnLayout<K, H>>(layout: L, key: H) => L;
  /**
   * The layout with `key` moved before `beforeKey`, or to the end for `null`; the same layout when the
   * move is of or past an unmovable column. An order equal to spec order is dropped.
   */
  withOrder: <L extends ColumnLayout<K, H>>(layout: L, key: K, beforeKey: K | null) => L;
  /** Every column, hidden ones included, in the layout's order. */
  columnOrder: (layout: ColumnLayout<K, H>) => K[];
  /**
   * Where `key` may land, per drawn slot — before each drawn column, then the end: the `beforeKey`
   * `withOrder` takes for a drop there, or `undefined` where it refuses one.
   */
  moveTargets: (layout: ColumnLayout<K, H>, key: K) => (K | null | undefined)[];
  /**
   * The `beforeKey` that moves drawn column `key` one drawn place left (`-1`) or right (`1`), or
   * `undefined` where it cannot move that way.
   */
  moveBy: (layout: ColumnLayout<K, H>, key: K, delta: -1 | 1) => K | null | undefined;
  /** The drawn columns, in the layout's order. */
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

  /** Every column, hidden ones included: each run of movable columns between two unmovable ones in its stored order. */
  const columnOrder = (layout: ColumnLayout<K, H>): K[] => {
    const rank = new Map<K, number>();
    for (const key of layout.order ?? []) if (!rank.has(key)) rank.set(key, rank.size);
    const placed = new Map(spec.map((c, i) => [c.key, rank.get(c.key) ?? rank.size + i]));
    const order: K[] = [];
    let run: K[] = [];
    const flush = () => {
      order.push(...run.sort((a, b) => placed.get(a)! - placed.get(b)!));
      run = [];
    };
    for (const c of spec) {
      if (c.movable) run.push(c.key);
      else {
        flush();
        order.push(c.key);
      }
    }
    flush();
    return order;
  };

  /** `order` with `key` moved before `beforeKey`, or to the end; `null` where the move is refused. */
  const moved = (order: readonly K[], key: K, beforeKey: K | null): K[] | null => {
    if (beforeKey !== null) column(beforeKey);
    if (!column(key).movable || beforeKey === key) return null;
    const others = order.filter((k) => k !== key);
    const at = beforeKey === null ? others.length : others.indexOf(beforeKey);
    const next = [...others.slice(0, at), key, ...others.slice(at)];
    return next.some((k, i) => !column(k).movable && order[i] !== k) ? null : next;
  };

  const withOrder = <L extends ColumnLayout<K, H>>(layout: L, key: K, beforeKey: K | null): L => {
    const next = moved(columnOrder(layout), key, beforeKey);
    if (!next) return layout;
    if (next.some((k, i) => k !== spec[i]!.key)) return { ...layout, order: next };
    const { order: _dropped, ...unordered } = layout;
    return unordered as L;
  };

  const isDrawn = (layout: ColumnLayout<K, H>, key: K) =>
    !column(key).hideable || !hiddenHas(layout, key);

  const visibleColumns = (layout: ColumnLayout<K, H>) =>
    columnOrder(layout).filter((key) => isDrawn(layout, key));

  /** Each drawn slot takes the last accepted insert point between its two drawn neighbours. */
  const moveTargets = (layout: ColumnLayout<K, H>, key: K) => {
    column(key);
    const order = columnOrder(layout);
    const drawnAt = order.flatMap((k, i) => (isDrawn(layout, k) ? [i] : []));
    return [...drawnAt, order.length].map((hi, s) => {
      const lo = s === 0 ? 0 : drawnAt[s - 1]! + 1;
      for (let p = hi; p >= lo; p--) {
        const before = order[p] ?? null;
        if (moved(order, key, before)) return before;
      }
      return undefined;
    });
  };

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
    withOrder,
    columnOrder,
    moveTargets,
    moveBy: (layout, key, delta) => {
      column(key);
      const from = visibleColumns(layout).indexOf(key);
      if (from < 0) return undefined;
      return moveTargets(layout, key)[delta < 0 ? from - 1 : from + 2];
    },
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
