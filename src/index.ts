export type {
  ColumnLayout,
  ColumnSpec,
  HeaderColumn,
  RowWindow,
  TableSort,
} from './types.js';

export { createTableModel, type TableModel } from './lib/tableModel.js';
export {
  BLOCK_ROWS,
  UNMEASURED_ROWS,
  scrollToReveal,
  visibleRange,
  type RevealInput,
  type VisibleRangeInput,
} from './lib/rowWindow.js';
export { TABLE_CELL, TABLE_GRID } from './lib/tableClasses.js';

export { useColumnAutoFit } from './hooks/useColumnAutoFit.js';
export { type ResizeDrag, useColumnResize } from './hooks/useColumnResize.js';
export {
  useTableKeyboard,
  type TableKeyEvent,
  type TableKeyStep,
  type TableKeyboardLink,
} from './hooks/useTableKeyboard.js';
export { useTypeAhead, type TypeAheadAnswer } from './hooks/useTypeAhead.js';

export { TableGrid, type RowPlace, type TableGridProps } from './components/TableGrid.js';
export { TableHeader, type TableHeaderProps } from './components/TableHeader.js';
export { TableRow, type TableRowProps } from './components/TableRow.js';
export { TableRuler, type TableRulerProps } from './components/TableRuler.js';
