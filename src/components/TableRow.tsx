import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { classNames } from '../lib/classNames.js';
import { TABLE_CELL, TABLE_GRID } from '../lib/tableClasses.js';

export interface TableRowProps<K extends string> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /**
   * The drawn columns; one cell each: `docs/map/invariant/drawn-columns-are-tracks-are-cells.md`.
   */
  columns: readonly K[];
  gridStyle: CSSProperties;
  /** 1-based position in the whole grid, the header being row 1. */
  rowIndex: number;
  cell: (key: K) => ReactNode;
  cellClassName?: (key: K) => string | undefined;
  cellTitle?: (key: K) => string | undefined;
}

/**
 * One grid row. `style` is merged under `gridStyle`, never over it:
 * `docs/map/invariant/drawn-columns-are-tracks-are-cells.md`.
 */
export function TableRow<K extends string>({
  columns,
  gridStyle,
  rowIndex,
  cell,
  cellClassName,
  cellTitle,
  className,
  style,
  ...rest
}: TableRowProps<K>) {
  return (
    <div
      role="row"
      aria-rowindex={rowIndex}
      className={classNames(TABLE_GRID, className)}
      style={{ ...style, ...gridStyle }}
      {...rest}
    >
      {columns.map((key, i) => (
        <div
          key={key}
          role="gridcell"
          aria-colindex={i + 1}
          className={classNames(TABLE_CELL, cellClassName?.(key))}
          title={cellTitle?.(key)}
        >
          {cell(key)}
        </div>
      ))}
    </div>
  );
}
