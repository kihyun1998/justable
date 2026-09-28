import { useRef } from 'react';

import {
  TYPE_AHEAD_MS,
  nextFocusIndex,
  typeAheadIndex,
  typeAheadStep,
} from '../lib/tableKeyboard.js';

/** What the grid tells the hook: how many whole rows its viewport shows. */
export interface TableKeyboardLink {
  rowsPerPage: number;
}

/** The parts of a key event the hook reads. A React or DOM keyboard event satisfies it. */
export interface TableKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}

/**
 * Where a key sent the keyboard's row. A type-ahead key that matched nothing answers `to: null`, so
 * the consumer can tell it from a key that was never the table's.
 */
export type TableKeyStep = { by: 'move'; to: number } | { by: 'typeAhead'; to: number | null };

/**
 * Keyboard movement for a table: the consumer calls `step` from wherever it receives keys, and
 * decides what a move means (selection, opening). Pass `link` to the grid as `keyboard`.
 */
export function useTableKeyboard({ now = Date.now }: { now?: () => number } = {}) {
  const link = useRef<TableKeyboardLink>({ rowsPerPage: 0 }).current;
  const typeAhead = useRef({ query: '', at: 0 });

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
      typeAhead.current = { query: '', at: 0 };
      event.preventDefault();
      return { by: 'move', to: moved };
    }

    const at = now();
    const running =
      typeAhead.current.query !== '' && at - typeAhead.current.at <= TYPE_AHEAD_MS;
    // One printable character without a chord modifier. A space only extends a running query:
    // `docs/map/territory/keyboard-movement.md`.
    if (
      event.key.length === 1 &&
      (event.key !== ' ' || running) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const { query, walk } = typeAheadStep(typeAhead.current.query, event.key, !running);
      typeAhead.current = { query, at };
      // Walking searches after the row, narrowing from the row itself:
      // `docs/map/territory/keyboard-movement.md`.
      const hit = typeAheadIndex(query, names, walk ? focus : focus === null ? null : focus - 1);
      if (hit !== null) event.preventDefault();
      return { by: 'typeAhead', to: hit };
    }

    return null;
  };

  return { step, link };
}
