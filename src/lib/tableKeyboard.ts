/**
 * Where the keyboard's row goes: movements and type-ahead, as pure functions. The rules and their
 * reasons: `docs/map/territory/keyboard-movement.md`.
 */

/** A named step of the keyboard's row. Which key asks for one is the consumer's. */
export type TableMovement = 'up' | 'down' | 'first' | 'last' | 'pageUp' | 'pageDown';

/** The parts of a key event type-ahead reads. A React or DOM keyboard event satisfies it. */
export interface TableKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}

/** How many rows a page moves when the viewport has not been measured. */
const FALLBACK_PAGE = 1;

export interface FocusMoveInput {
  movement: TableMovement;
  /**
   * Where focus is now. `null` before the user has moved at all. From an integer outside the list,
   * a movement counts from it and clamps where it lands; a non-integer moves as `null` does.
   */
  focus: number | null;
  /** How many rows there are, in screen order. */
  total: number;
  /** How many whole rows the viewport shows — measured, so it can be 0 before layout. */
  rowsPerPage: number;
}

/** Where this movement takes focus, or `null` when there are no rows or it is not a movement. */
export function nextFocusIndex({
  movement,
  focus: given,
  total,
  rowsPerPage,
}: FocusMoveInput): number | null {
  if (total <= 0) return null;

  const focus = given !== null && Number.isInteger(given) ? given : null;
  const last = total - 1;
  const clamp = (i: number) => Math.max(0, Math.min(last, i));
  const page = Math.max(FALLBACK_PAGE, Math.floor(rowsPerPage));

  switch (movement) {
    case 'down':
      return focus === null ? 0 : clamp(focus + 1);
    case 'up':
      return focus === null ? 0 : clamp(focus - 1);
    case 'first':
      return 0;
    case 'last':
      return last;
    case 'pageDown':
      return focus === null ? 0 : clamp(focus + page);
    case 'pageUp':
      return focus === null ? 0 : clamp(focus - page);
    default:
      return null;
  }
}

/** Where a type-ahead query lands in `names` (screen order), searching after `from`; `null` if none. */
export function typeAheadIndex(
  query: string,
  names: readonly string[],
  from: number | null,
): number | null {
  const needle = query.toLowerCase();
  if (!needle || names.length === 0) return null;

  const start = from === null ? 0 : from + 1;
  for (let step = 0; step < names.length; step += 1) {
    const i = (start + step) % names.length;
    if (names[i].toLowerCase().startsWith(needle)) return i;
  }
  return null;
}

/** `focus` when it names one of `total` rows — an integer, `0 <= focus < total` — else `null`. */
export function rowOrNull(focus: number | null, total: number): number | null {
  return focus !== null && Number.isInteger(focus) && focus >= 0 && focus < total ? focus : null;
}

export interface TypeAheadStep {
  /** The query to search for. */
  query: string;
  /** Search after the row, checking it last, rather than from the row itself. */
  after: boolean;
}

/**
 * What a typed character does to the query: a fresh query and a walk (the same letter again) search
 * after the row; an extension searches from it.
 */
export function typeAheadStep(prev: string, key: string, fresh: boolean): TypeAheadStep {
  if (fresh || prev.toLowerCase() === key.toLowerCase()) return { query: key, after: true };
  return { query: prev + key, after: false };
}
