/**
 * Which data rows a marquee touches. Only its vertical span counts; the rules and their reasons:
 * `docs/map/territory/marquee.md`.
 */

/** The rows a marquee touches, by data-row index: `anchor` nearest the press, `head` nearest the pointer. */
export interface MarqueeRange {
  anchor: number;
  head: number;
}

export interface MarqueeRangeInput {
  /** The press's y on the rows' canvas, in px. */
  from: number;
  /** The pointer's y on the rows' canvas, in px. */
  to: number;
  /** One row's measured height, in px. */
  rowHeight: number;
  /** How many rows the list has in all. */
  total: number;
}

/** The contiguous rows whose band the span overlaps, or `null` when it overlaps none. */
export function marqueeRange({ from, to, rowHeight, total }: MarqueeRangeInput): MarqueeRange | null {
  if (!(rowHeight > 0) || total <= 0) return null;

  const top = Math.min(from, to);
  const bottom = Math.max(from, to);
  const first = Math.floor(top / rowHeight);
  // A span ending on a border overlaps nothing of the row below; a zero-height span keeps its row.
  const last = Math.max(first, Math.ceil(bottom / rowHeight) - 1);
  if (last < 0 || first > total - 1) return null;

  const low = Math.max(0, first);
  const high = Math.min(total - 1, last);
  return from <= to ? { anchor: low, head: high } : { anchor: high, head: low };
}
