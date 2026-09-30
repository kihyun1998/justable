import { useRef } from 'react';

import { type TableKeyEvent, nextFocusIndex } from '../lib/tableKeyboard.js';
import { type TypeAheadOptions, useTypeAhead } from './useTypeAhead.js';

/** What the grid tells the hook: how many whole rows its viewport shows. */
export interface TableKeyboardLink {
  rowsPerPage: number;
}

/**
 * Where a key sent the keyboard's row. A type-ahead key that matched nothing answers `to: null`, so
 * the consumer can tell it from a key that was never the table's.
 */
export type TableKeyStep = { by: 'move'; to: number } | { by: 'typeAhead'; to: number | null };

/**
 * Keyboard movement for a table: the consumer calls `step` from wherever it receives keys, and
 * decides what a move means (selection, opening). Pass `link` to the grid as `keyboard`. Its
 * type-ahead is `useTypeAhead`'s, with the same options.
 */
export function useTableKeyboard(options: TypeAheadOptions) {
  const link = useRef<TableKeyboardLink>({ rowsPerPage: 0 }).current;
  const typeAhead = useTypeAhead(options);

  /** Answers a key, and claims the event when it moves the row; `null` for a key not the table's. */
  const step = (
    event: TableKeyEvent,
    { focus, names }: { focus: number | null; names: readonly string[] },
  ): TableKeyStep | null => {
    const moved = nextFocusIndex({
      key: event.key,
      focus,
      total: names.length,
      rowsPerPage: link.rowsPerPage,
    });
    if (moved !== null) {
      // A move ends any running query: `docs/map/territory/keyboard-movement.md`.
      typeAhead.end();
      event.preventDefault();
      return { by: 'move', to: moved };
    }

    const answer = typeAhead.step(event, { focus, names });
    return answer === null ? null : { by: 'typeAhead', to: answer.to };
  };

  return { step, link };
}
