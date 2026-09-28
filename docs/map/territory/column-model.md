# Column model

## What it is

The table's pure decisions about columns, bound to one column spec: what width a column is drawn at,
which columns are drawn, the `grid-template-columns` that lays them out, the three-step sort cycle a
header press walks, and a sorted copy of the rows. `createTableModel(spec)` returns them as one
object; nothing in it touches the DOM or holds state. The user's changes arrive as a `ColumnLayout`
the consumer stores; the model only reads and returns new ones.

## Governing decisions

**None.** No record in this repository decides the column model. PenTerm's reading of peer file
managers for the sort cycle (see `## Reference behaviour`) is evidence, not a decision.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **The spec owns what is fixed; the layout owns only what the user changed.** Bounds, the default
  width, whether a column may hide, the first sort direction and the comparator are the spec's. A
  `ColumnLayout` holds widths the user set and columns they hid; an absent width means the default.
  `createTableModel` binds the functions to one spec so a consumer can re-export them under its own
  names and its callers never see the spec.
- **An unknown key throws.** Every function looks its column up by key and throws `unknown column`
  rather than answering for a column the spec does not have.
- **A stored width is clamped and rounded on read and on write; the default is not.** `columnWidth`
  falls back to `defaultWidth` for an absent or non-finite stored value and returns it as written, so
  a spec whose default lies outside its own bounds is drawn at that default until the first drag.
  `withWidth` clamps before storing.
- **Layout-changing functions keep the rest of the layout.** `withWidth` and `toggleHidden` are
  generic over `L extends ColumnLayout`, so a consumer's layout with more fields round-trips intact.
- **A column that cannot hide is drawn even if the layout lists it.** `visibleColumns` filters on
  `!hideable || !hidden`; `isHidden` answers list membership only. The type parameter `H` is how a
  consumer narrows `hidden` to the hideable keys.
- **Drawn columns come out in spec order**, never in the order they were un-hidden.
- **The grid template is one px track per drawn column, then a filler that is not a column**
  (`minmax(0,1fr)`). Each column owns its width, so a border drag changes that column alone and the
  total grows or shrinks; the filler takes the slack — without it a 1,250 px pane with 528 px of
  tracks left a dead strip under hover (PenTerm) — and folds to zero when the tracks overflow, giving
  way to horizontal scroll. The filler has no cell, no `aria-colindex` and no handle: see
  [drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md).
- **The sort cycle has three steps**: a press on an unsorted column sorts it in its
  `firstSortDesc` direction, the next press the other way, the third removes the sort. A press on
  another column starts that column at its own first direction. No sort is `undefined`, never a value.
- **`sortRows` always returns a copy.** With no sort the copy keeps the input order — the consumer's
  order, which is the point of the third step. With a sort, `desc` negates the comparator and ties
  fall to `tieBreak`, **which `desc` does not reverse**; with no `tieBreak`, `Array.prototype.sort`'s
  stability keeps input order.

## Code

- `src/lib/tableModel.ts` — `createTableModel`, `TableModel`
- `src/types.ts` — `ColumnSpec`, `ColumnLayout`, `TableSort`

## Reference behaviour

**None.** in this repository. PenTerm's `explorer-block.md` § Reference behavior (at the commit in
[provenance](../MAP.md#penterm-provenance)) records a reading of electerm, Files, Cyberduck, waveterm,
antd, MUI and AG Grid on the sort cycle's step count, which settles that three steps is a deliberate
divergence from file-manager peers and the shape of the general-purpose grids. `docs/agents/thegraph.md`
§ References, where this repo's references would be kept, is empty.

## Cross-cutting invariants

- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) —
  `visibleColumns` is the list the other sites must all be handed; `gridTemplate` is the track side.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  bounds, sort direction, comparator and hideability are the spec's, never defaults here.

## Blast radius

- [Header row](header-row.md) — draws one header per drawn column and shows the sort state; a change
  to `nextSort` or to column order shows there first.
- [Table row](table-row.md) — its `columns` must be `visibleColumns`, and its `gridStyle` this
  template.
- [Grid scaffold](grid-scaffold.md) — `colCount` is the drawn-column count; a change to what is drawn
  changes what it must be told.
- [Column resize](column-resize.md) — reports an unclamped width and relies on `withWidth` to clamp.
- [Auto-fit](auto-fit.md) — its measured width is also unclamped; same reliance.

## Known holes / open

- **The unclamped default is unexplained.** Whether a default outside its bounds is meant to be
  allowed or merely not checked is recorded nowhere.
- **The tie-break's direction** under `desc` is fixed by the code and decided by nobody: a consumer
  whose `tieBreak` is a secondary key gets it ascending under a descending primary.
- **One consumer.** The API was cut along PenTerm's Explorer; a second consumer is the first real
  test of where the seams are (PenTerm's known hole, carried over as an observation).
