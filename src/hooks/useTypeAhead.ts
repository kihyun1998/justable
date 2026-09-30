import { useRef } from 'react';
import { type TableKeyEvent, typeAheadIndex, typeAheadStep } from '../lib/tableKeyboard.js';

/** Where a type-ahead key landed in `names`, or `to: null` when it matched nothing. */
export interface TypeAheadAnswer {
  to: number | null;
}

/** The consumer's side of type-ahead. */
export interface TypeAheadOptions {
  /**
   * How long a query stays open after its last character, in ms. At or below 0, or `NaN`: no query
   * stays open. `Infinity`: no pause ends one.
   */
  windowMs: number;
  /** The clock the window is timed with. */
  now?: () => number;
}

/**
 * Type-ahead for any list of names in screen order: the consumer calls `step` from its key handler,
 * and `end` whenever it moves the row by other means. The rules: `docs/map/territory/keyboard-movement.md`.
 */
export function useTypeAhead({ windowMs, now = Date.now }: TypeAheadOptions) {
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
    // A window not above 0 keeps no query open: `docs/map/territory/keyboard-movement.md`.
    const running =
      state.current.query !== '' && windowMs > 0 && at - state.current.at <= windowMs;
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
    const { query, after } = typeAheadStep(state.current.query, event.key, !running);
    // A fresh letter and a walk search after the row, narrowing from the row itself.
    const hit = typeAheadIndex(query, names, after ? focus : focus === null ? null : focus - 1);
    // A miss ends the query: `docs/map/territory/keyboard-movement.md`.
    state.current = hit === null ? { query: '', at: 0 } : { query, at };
    if (hit !== null) event.preventDefault();
    return { to: hit };
  };

  return { step, end };
}
