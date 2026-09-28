import type { ReactNode, Ref } from 'react';

import { classNames } from '../lib/classNames.js';
import { TABLE_CELL } from '../lib/tableClasses.js';

export interface TableRulerProps<Row, K extends string> {
  ref?: Ref<HTMLDivElement>;
  /** The column being measured. */
  column: K;
  /** Every row, not the drawn window — a fit must not depend on the scroll position. */
  rows: readonly Row[];
  /** The same content the real cell draws, so the two cannot measure apart. */
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
  return (
    <div ref={ref} aria-hidden inert className={classNames('justable:h-0 justable:overflow-hidden', className)}>
      <div data-table-ruler={column}>
        {rows.map((row, i) => (
          <div key={i} className={classNames(TABLE_CELL, cellClassName?.(column), 'justable:w-max')}>
            {cell(row, column)}
          </div>
        ))}
      </div>
    </div>
  );
}
