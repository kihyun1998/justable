# A row index names a place

## The fact

A row index — `focus`, a Shift anchor, a marquee's `anchor` and `head`, every row `move` and
`typeAhead` answer — names **a place in the rows as they are now drawn**, never a row. When the rows
reorder or are replaced, the same index names whatever row now sits there. Keeping an index on its
row across a reorder is the consumer's, done through something that names the row: the example's
file table re-points its indices by file name after a sort, and the quick start holds its keyboard
row as a name and derives the index at render. The engine holds no row identity for it.

Checkable: every row a consumer holds is held by a name, or held as an index (`useState<number |
null>`) with every handler that changes the order or the list (`onSort`, a filter, a replaced list)
paired with a re-pointing or written down as not needing one.

## Why it is cross-cutting

The index is produced in one territory and held in another that do not call each other: keyboard
movement answers it, the marquee reports it, the grid draws `aria-activedescendant` and reveals from
it, and the consumer holds it between them. Nothing in that chain sees a sort, which happens in the
consumer's `rows`, so each consumer site that holds an index has to re-point it on its own.

## Territories it holds in

- [Keyboard movement](../territory/keyboard-movement.md) — `move` and `typeAhead` take `focus` and
  answer an index; README § Keyboard makes keeping `focus` on the right row the consumer's. A sort
  is a move only if the consumer lets the index stay; the example re-points, so the query is kept
  (#89).
- [Grid scaffold](../territory/grid-scaffold.md) — `focus` becomes the row id
  `` `${rowIdPrefix}-row-${index}` `` in `aria-activedescendant`, and the grid reveals that index; a
  stale index reveals and announces another row without any error.
- [Marquee](../territory/marquee.md) — a drag reports `range.anchor` and `range.head` as indices; the
  example stores them as its anchor and `focus` at the drag's end.
- [Verification gates](../territory/verification-gates.md) — the example's sites: `FileTable`
  re-points `focus` and `anchor` after a sort (#89); `People` (the quick start) holds the keyboard
  row by name and passes `rows.findIndex` of it as `focus` (#91); `FolderList` holds its cursor as
  an index over names that never reorder.

## What a violation looks like

- After a sort the keyboard row is another file at the same position, while a selection held by
  name stays on its files.
- A Shift-extend after a sort ranges from whatever row took the anchor's place.
- A letter typed within the type-ahead window narrows from the row now at the old index.

## Discovery history

- #89 (2026-11-03, example) — found by the completeness read on #88: `c`, a Name sort, `i` within
  700 ms landed on `citrus.csv` by the old query while the keyboard row had become `gamma-4996.md`.
  The maintainer chose to keep the index on its file and keep the query.
- #91 (2026-11-03, quick start) — `People` kept the index: in jsdom, the keyboard row on `Ada` and
  an Age sort left `people-row-0`, now `Grace`. The maintainer chose to hold the row by name there
  and end the query on a click, over ending the query on a click only with a sentence about sorting,
  and over leaving it.

## Where it will recur

- A filter, a search box or a replaced list in a consumer: every index it holds names a new row.
