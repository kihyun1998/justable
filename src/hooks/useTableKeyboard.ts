import { useRef } from 'react';

import { type TableMovement, nextFocusIndex } from '../lib/tableKeyboard.js';
import { type TypeAheadOptions, useTypeAhead } from './useTypeAhead.js';

/** What the grid tells the hook: how many whole rows its viewport shows. */
export interface TableKeyboardLink {
  rowsPerPage: number;
}

/**
 * Keyboard movement for a table. The consumer binds its own keys: it calls `move` with the movement
 * a key asks for, `typeAhead` with a typed character, and `end` whenever it moves the row by other
 * means; what a move means (selection, opening) is the consumer's too. Pass `link` to the grid as
 * `keyboard`. Its type-ahead is `useTypeAhead`'s, with the same options, and `typeAhead` and `end`
 * are that type-ahead's. Every function is one function for the hook's life.
 */
export function useTableKeyboard(options: TypeAheadOptions) {
  const link = useRef<TableKeyboardLink>({ rowsPerPage: 0 }).current;
  const typeAhead = useTypeAhead(options);

  const { end } = typeAhead;

  /** Where `movement` takes the row, ending any running query; `null` when there are no rows. */
  const move = useRef(
    (movement: TableMovement, { focus, total }: { focus: number | null; total: number }) => {
      const moved = nextFocusIndex({ movement, focus, total, rowsPerPage: link.rowsPerPage });
      // A move ends any running query: `docs/map/territory/keyboard-movement.md`.
      if (moved !== null) end();
      return moved;
    },
  ).current;

  return { move, typeAhead: typeAhead.step, end, link };
}
