import { useRef } from 'react';
import {
  TYPE_AHEAD_MS,
  type TableKeyEvent,
  typeAheadIndex,
  typeAheadStep,
} from '../lib/tableKeyboard.js';

/** Where a type-ahead key landed in `names`, or `to: null` when it matched nothing. */
export interface TypeAheadAnswer {
  to: number | null;
}

/**
 * Type-ahead for any list of names in screen order: the consumer calls `step` from its key handler,
 * and `end` whenever it moves the row by other means. The rules: `docs/map/territory/keyboard-movement.md`.
 */
export function useTypeAhead({ now = Date.now }: { now?: () => number } = {}) {
  const state = useRef({ query: '', at: 0 });

  /** Ends any running query. */
  const end = () => {
    state.current = { query: '', at: 0 };
  };

  /** Answers a type-ahead key and claims the event on a hit; `null` for a key that is not one. */
  const step = (
    event: TableKeyEvent,
    { focus, names }: { focus: number | null; names: readonly string[] },
  ): TypeAheadAnswer | null => {
    const at = now();
    const running = state.current.query !== '' && at - state.current.at <= TYPE_AHEAD_MS;
    // One printable character without a chord modifier. A space only extends a running query.
    if (
      event.key.length !== 1 ||
      (event.key === ' ' && !running) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return null;
    }
    const { query, walk } = typeAheadStep(state.current.query, event.key, !running);
    // Walking searches after the row, narrowing from the row itself.
    const hit = typeAheadIndex(query, names, walk ? focus : focus === null ? null : focus - 1);
    // A miss ends the query: `docs/map/territory/keyboard-movement.md`.
    state.current = hit === null ? { query: '', at: 0 } : { query, at };
    if (hit !== null) event.preventDefault();
    return { to: hit };
  };

  return { step, end };
}
