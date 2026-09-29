import type { ReactNode, Ref } from 'react';

import { classNames } from '../lib/classNames.js';
import { TABLE_CELL } from '../lib/tableClasses.js';

export interface TableRulerProps<Row, K extends string> {
  ref?: Ref<HTMLDivElement>;
  /** The column being measured, or the columns — one group each. */
  column: K | readonly K[];
  /** Every row, not the drawn window. */
  rows: readonly Row[];
  /** The same content the real cell draws. */
  cell: (row: Row, key: K) => ReactNode;
  cellClassName?: (key: K) => string | undefined;
  /** Inherited type the real cells get from their row. */
  className?: string;
}

/** Off-screen cells at their natural width, for `useColumnAutoFit` to read back. */
export function TableRuler<Row, K extends string>({
  ref,
  column,
  rows,
  cell,
  cellClassName,
  className,
}: TableRulerProps<Row, K>) {
  const columns: readonly K[] = typeof column === 'string' ? [column] : column;
  return (
    <div ref={ref} aria-hidden inert className={classNames('justable:h-0 justable:overflow-hidden', className)}>
      {columns.map((key) => (
        <div key={key} data-table-ruler={key}>
          {rows.map((row, i) => (
            <div key={i} className={classNames(TABLE_CELL, cellClassName?.(key), 'justable:w-max')}>
              {cell(row, key)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
