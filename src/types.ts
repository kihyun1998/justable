/** One column's fixed facts: its bounds, whether it may be hidden, and how it orders rows. */
export interface ColumnSpec<Row, K extends string> {
  key: K;
  /** px when the layout records no width. */
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** A column that cannot be hidden is always drawn. */
  hideable: boolean;
  /** A column that cannot move keeps its spec position, and no movable column passes it. */
  movable: boolean;
  /** The direction the first press on this column's header sorts in. */
  firstSortDesc: boolean;
  /** Ascending order of two rows by this column. */
  compare: (a: Row, b: Row) => number;
}

/** What the user changed: widths they set, columns they hid and the order they moved them into. Absent means default. */
export interface ColumnLayout<K extends string, H extends K = K> {
  widths: Partial<Record<K, number>>;
  hidden: H[];
  /** Every column, hidden ones included, in the order they are drawn. Absent means spec order. */
  order?: K[];
}

/** A sort on one column. The absence of a sort is `undefined`, never a value. */
export interface TableSort<K extends string> {
  key: K;
  desc: boolean;
}

/** A column as the header draws it. */
export interface HeaderColumn<K extends string> {
  key: K;
  label: string;
  width: number;
}

/** Rows the viewport can see, by index. `end` is exclusive. */
export interface RowWindow {
  start: number;
  end: number;
}
