# Column move

## What it is

Moving a column, in two halves that never call each other. The model's half: `ColumnLayout.order`,
the spec's `movable`, and `withOrder`, which `visibleColumns` and `gridTemplate` read. The header's
half: `useColumnMove`, an internal hook `TableHeader` runs when given `move`, which turns a press on a
movable column's cell into a drag past a threshold, draws a landing line, and reports the drop once
as `onMove(key, beforeKey)`. The consumer joins them by calling `withOrder` from `onMove` and storing
the layout.

## Governing decisions

- **#61, the maintainer's calls at the confirm stop, 2026-10-14.** Shown: the issue's proposal (a
  bare `onMove?` prop), [mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md),
  and the marquee's `MarqueeOptions` as precedent. Each is a judgement, reversible only by the
  maintainer:
  - the header takes **`move?: { refusePress, threshold, onMove }`**, not the issue's bare `onMove?`
    — rejected: an engine-held threshold (breaks the invariant), and flat optional props (the type
    cannot require the threshold when `onMove` is given);
  - the landing line paints a **new role, `--table-move-indicator`**, rather than reusing
    `--table-resize-line-active`;
  - **`ColumnSpec.movable` is required**, a breaking change to the spec type;
  - **Escape and blur do not cancel a move** in this change.

  It did not cover: the line's shape and placement, how the landing slot is computed, the rule for a
  stored order that crosses a pin, `HeaderColumn.movable` being optional, the data attribute's name,
  or the press not being prevented — those below are derivations.

## Design model

- **The order lists every column, hidden ones too**, so a column hidden and shown again returns to
  its place. `withOrder` always stores the whole order, or none: an order equal to spec order is
  dropped from the layout, the way an absent width means the default.
- **An unmovable column splits the order into runs.** Each run of movable columns between two
  unmovable ones is sorted by the stored order; an unmovable column is drawn at its spec index. So a
  stored order cannot carry a column past a pin even when written by hand, or by a spec that has
  since pinned a column. A derivation, 2026-10-14 — the issue said only that `withOrder` refuses such
  a move.
- **The stored order is read leniently.** A key the spec lacks is ignored; a spec key the order lacks
  sorts after the listed ones, in spec order, within its run; a key listed twice is placed at its
  first.
- **`withOrder` refuses by returning the same layout** — the same object — for a move of an unmovable
  column, a move that would shift any unmovable column's index, and a move of a column before
  itself. An unknown key throws, as everywhere in the [column model](column-model.md).
- **The press is not prevented.** The sort button keeps its focus on press and its click below the
  threshold. Measured in Chrome 2026-10-14 (`check:example`): a drag from a header label selects no
  text, unscaled and inside `scale(0.5)`.
- **Below the threshold the press is the sort press it always was.** Past it — more than `threshold`
  screen px on either axis, the marquee's rule — the release swallows the click the browser sends
  next (`swallowNextClick`, shared with the [marquee](marquee.md)), so no `onSort` follows a drop,
  even a drop where the column already was.
- **The landing slot is found on screen; the line is drawn in layout px.** The slot is the count of
  drawn cells whose screen middle lies left of the pointer, clamped to the run the dragged column is
  in; both are screen px, so a scale needs no division. The line sits at that cell's `offsetLeft`
  (or the last cell's right edge for the end), layout px inside the scaled tree. Measured in Chrome
  2026-10-14: computing it from screen boxes instead put it 65 px off inside `scale(0.5)`.
- **A scroll under a still pointer re-reads the slot**, through the drag's scroll moment — the cells
  move under the pointer.
- **The line is set only when its place changes, checked before `setMoving` is called.** Measured
  2026-10-14 under a `Profiler`: an updater that returned the same state still cost one commit over
  two moves, since React may render once before it bails out; the check outside it costs none.
- **`threshold`, `refusePress` and `onMove` are read at the press**, where the marquee reads its
  options through a ref at each report. A consumer whose `onMove` closes over a layout gets the one
  current at the press, which nothing but the drop itself changes.
- **A drop on the slot either side of the column itself reports nothing.**
- **The line is a child of the header row, absolutely positioned**, so it takes no track; see
  [drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md).
- **`HeaderColumn.movable` is optional; absent, the column does not move.** The header's identity
  default, so a consumer that passes no `move` changes nothing. A derivation, 2026-10-14.
- **The handle's press never reaches the cell**: `startResize` stops its propagation, which is all
  that keeps a border drag from also being a move.

## Code

- `src/hooks/useColumnMove.ts` — `useColumnMove`, `ColumnMoveOptions`, `ColumnMoving`, `moveSlot`
- `src/components/TableHeader.tsx` — `move`, `rowRef`, `data-table-move-indicator`
- `src/lib/tableModel.ts` — `withOrder`, `columnOrder`
- `src/types.ts` — `ColumnLayout.order`, `ColumnSpec.movable`, `HeaderColumn.movable`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  `refusePress` and `threshold` are required inside `move`, and which columns move is the spec's.
- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — the
  order is `visibleColumns`' order, so the header, rows and template move together.

## Blast radius

- [Column model](column-model.md) — `visibleColumns` and `gridTemplate` read the order.
- [Header row](header-row.md) — the press lands on its cells and the line in its row.
- [Drag lifetime](drag-lifetime.md) — the move is a third `useDrag` instance; a change to the
  release moves when the drop is reported.
- [Marquee](marquee.md) — `swallowNextClick` lives there and is shared.
- [Colour variables](colour-variables.md) — `--table-move-indicator`.
- [Verification gates](verification-gates.md) — `check:example` drags Size onto Kind and onto the
  pinned Name, unscaled and in `scale(0.5)`.

## Known holes / open

- **A hidden unmovable column is no boundary to the header.** The header finds runs among the drawn
  columns, so with a pinned, hideable column hidden it shows a landing place past it, and `withOrder`
  then refuses the drop: the line promised a move that did not happen. No consumer has a hideable pin
  today.
- **No Escape or blur cancel**, where the marquee has both — out of #61 by the maintainer's call.
- **No edge scroll.** A column dragged past the header's edge does not scroll the grid, and unlike
  the border drag nothing reports the pointer for a consumer's loop.
- **Mouse only**, as every drag here.
