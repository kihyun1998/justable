/** One column's fixed facts: its bounds, whether it may be hidden, and how it orders rows. */
export interface ColumnSpec<Row, K extends string> {
  key: K;
  /** px when the layout records no width. */
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** A column that cannot be hidden is always drawn. */
  hideable: boolean;
  /** The direction the first press on this column's header sorts in. */
  firstSortDesc: boolean;
  /** Ascending order of two rows by this column. */
  compare: (a: Row, b: Row) => number;
}

/** What the user changed: widths they set and columns they hid. Absent means default. */
export interface ColumnLayout<K extends string, H extends K = K> {
  widths: Partial<Record<K, number>>;
  hidden: H[];
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
