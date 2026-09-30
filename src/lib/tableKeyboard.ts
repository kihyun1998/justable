/**
 * Where a key moves the keyboard's row: movement keys and type-ahead, as pure functions. The rules
 * and their reasons: `docs/map/territory/keyboard-movement.md`.
 */

/** The parts of a key event the keyboard hooks read. A React or DOM keyboard event satisfies it. */
export interface TableKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}

/** How long a type-ahead query stays open, in ms. */
export const TYPE_AHEAD_MS = 700;

/** How many rows a page moves when the viewport has not been measured. */
const FALLBACK_PAGE = 1;

export interface FocusMoveInput {
  key: string;
  /** Where focus is now. `null` before the user has moved at all. */
  focus: number | null;
  /** How many rows there are, in screen order. */
  total: number;
  /** How many whole rows the viewport shows — measured, so it can be 0 before layout. */
  rowsPerPage: number;
}

/** Where this key moves focus, or `null` if it is not a movement key (←/→ included). */
export function nextFocusIndex({ key, focus, total, rowsPerPage }: FocusMoveInput): number | null {
  if (total <= 0) return null;

  const last = total - 1;
  const clamp = (i: number) => Math.max(0, Math.min(last, i));
  const page = Math.max(FALLBACK_PAGE, Math.floor(rowsPerPage));

  switch (key) {
    case 'ArrowDown':
      return focus === null ? 0 : clamp(focus + 1);
    case 'ArrowUp':
      return focus === null ? 0 : clamp(focus - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageDown':
      return focus === null ? 0 : clamp(focus + page);
    case 'PageUp':
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
