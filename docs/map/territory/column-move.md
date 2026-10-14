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
  - **Escape and blur do not cancel a move** in this change — reversed by the maintainer at #72
    (below).

  It did not cover: the line's shape and placement, how the landing slot is computed, the rule for a
  stored order that crosses a pin, `HeaderColumn.movable` being optional, the data attribute's name,
  or the press not being prevented — those below are derivations.

- **#62, the maintainer's call at triage, 2026-10-14.** Shown: a jsdom reproduction (a hidden
  unmovable column; the line drawn past it, `onMove('a', null)`, `withOrder` refusing) and three
  directions — (a) the model's rule handed to the header, (b) a hidden unmovable column stops being a
  boundary in the model, (c) leave it documented. Chosen: **(a)**; (b) would break #61's promise that
  an unmovable column keeps its spec position. At the confirm stop, **#64 (a public full order) joined
  the same change**. Not covered: the shape of the answer (per drawn slot), the names `moveTargets`,
  `columnOrder` and `targets`, `targets` being required, and which insert point a slot takes — those
  are derivations, below. Then, shown that `HeaderColumn.movable` overlapped `targets` and was
  unreleased: **removed**, the press deciding from `targets` alone.
- **#72, the maintainer's calls at the to-spec stop, 2026-10-14: Escape and a lost window cancel a
  move, the way they cancel the marquee.** This reverses #61's call. Shown: PenTerm's ADR-0100 (every
  gesture that commits at the release answers Escape; a column move commits at the release), the
  marquee's existing Escape and blur in `useMarquee`, and the alternative of handing the consumer a
  `cancel()` so the engine binds no key. Chose the marquee's shape — the engine claims Escape while a
  move runs — over `cancel()` and over both. Theirs to reverse. It did not cover what a cancel reports,
  the click after it, or Escape before the threshold — those are derivations, below (#75).
- **#63, the maintainer's call at triage, 2026-10-14.** Shown: no key path anywhere in `src/`; AG
  Grid's column-moving docs (Shift+←/→ on a focused header) and MUI X's column-ordering page (drag
  only, keyboard not stated); three directions — (a) mechanism here, key and announcement the
  consumer's, (b) the engine binds a key in the header, (c) not now. Chosen: **(a)**; (b) holds a key
  choice as an engine default, against
  [mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md).
  Not covered: the names `moveBy` and `onColumnKeyDown`, the callback on the cell, and whether the
  engine restores focus — derivations, below.

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
- **Where a column may land is the model's answer, per drawn slot** (#62). `moveTargets(layout, key)`
  has one entry per drawn slot — before each drawn column, then the end — holding the `beforeKey` to
  report there, or `undefined` where `withOrder` refuses. It and `withOrder` share one internal
  `moved`, so they agree by construction; the header keeps no copy of the run rule and takes the
  answer through the required `move.targets`. A set of allowed `beforeKey`s would not do: with a
  hidden pin after the dragged column's run, the end of the run is "before the pin", a key the header
  never draws — it would report the drawn column past the pin and be refused.
- **A slot between two drawn columns takes the last accepted insert point between them**, the one
  next to the drawn column on its right; a hidden movable column in the gap keeps its place before
  the dropped one.
- **The landing slot is found on screen; the line is drawn in layout px.** The slot under the pointer
  is the count of drawn cells whose screen middle lies left of it, moved to the nearest allowed slot;
  the column's own two slots are always allowed, and a drop there reports nothing. Both are screen
  px, so a scale needs no division. The line sits at that cell's `offsetLeft`
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
- **Whether a press may move a column is `targets`' answer too**: a press on a column whose targets
  offer no slot but its own two starts no move, and stays a sort press. `HeaderColumn` carries no
  `movable` — #61 added one and #62 removed it before any release (the maintainer's call, below),
  so the header holds no second copy of which columns move.
- **A key reaches the consumer through `onColumnKeyDown(key, event)`, on the header cell**, so it
  takes keys from the sort button inside it; absent, the cell has no key handler. The grid's
  `onKeyDown` never hears those keys ([grid scaffold](grid-scaffold.md), #68). The engine binds
  no key to move a column and renders no announcement; the one key it claims is Escape, while a
  mouse move runs (#75). `moveBy(layout, key, ±1)` reads `moveTargets` at the slot one
  drawn place over — `from − 1` left, `from + 2` right, the second because `from + 1` is the column's
  own right edge — so a key step obeys every boundary a drag does.
- **Focus survives a move without the engine's help — React DOM restores it.** Measured in Chrome
  155, 2026-10-14: moving a column right, React moves the focused cell itself (`insertBefore`), focus
  falls to `body` and a `focusout` fires (`Kind→null`); moving one left, React moves the neighbour and
  focus is never lost. Either way the button ends focused, with `:focus-visible`, because React DOM's
  commit (19.2.8, `react-dom-client`) focuses the element that was focused before the mutation when
  it is still in the document. A bare `insertBefore` of the focused cell left focus on `body`. So a
  consumer listening for `focusout` on the header sees one transient blur per move to the right.
- **The consumer can draw the whole move (#74).** `move.onDrag` hears every pointer move and every
  scroll past the threshold as a `ColumnMoveDrag`, then `null` from the drag's `ended`, so exactly
  once on every ending path — release, a second press, unmount — as `onResizeDrag` does; never below
  the threshold, never for a press that starts no move, and nothing for the release itself, whose
  only report is the `null`. Every move is reported, not only a changed slot, as the marquee reports
  every move: an edge-scroll loop reads the pointer from it. A derivation, 2026-10-14, at #74's
  confirm; #72 is the spec.
  - **Screen px throughout**, unlike the engine's own line: a consumer draws in a portal, where a
    screen box is exact under any `scale`. `line.x` is the landing cell's screen left (the last
    cell's right for the end), `top` and `bottom` the header row's; `cell` is the moved cell's
    screen box read once, at the first report, so a scroll does not move it. Measured in Chrome
    (`check:example`, `?ghost`), unscaled and inside `scale(0.5)`: the portal line within 1.5 px of
    the border, the ghost as wide as the column on screen; with `line.x` taken from `offsetLeft`
    both line checks fail, unscaled too (260 against 520), since `offsetLeft` is the header row's.
  - **`beforeKey` is `undefined` on the column's own two slots**, where a drop reports nothing —
    otherwise `targets`' entry.
  - **Given `onDrag`, the engine draws no line**; absent, the line is drawn as before. That keeps
    every consumer of 0.4 unchanged; #72 recorded it as the spec's choice.
  - The report adds no render: it is called from the move handler, and the line's state is still
    set only when its place changes.
- **The moved column's cell carries `data-table-moving`** from the first move past the threshold
  until the move ends, with or without `onDrag`. It follows the same state as the line, so it never
  shows for a sort press.
- **Escape and a lost window cancel a running move** (#75), as the [marquee](marquee.md)'s do:
  `window` keydown in the capture phase, Escape only, only past the threshold, with
  `preventDefault` and `stopPropagation` — so neither `onColumnKeyDown` nor the grid's `onKeyDown`
  hears the Escape that cancelled. Before the threshold Escape is the consumer's, and a lost window
  ends the armed press quietly. A cancel calls no `onMove`; it ends the drag through `useDrag`'s
  `end`, so `ended` clears the line and `data-table-moving` and sends `onDrag(null)` once, as on
  every other end. It arms `swallowNextClick` first, because the held button's release comes after
  the drag has let go ([marquee](marquee.md), #73). Measured in Chrome (`check:example`, 2026-10-14):
  a drag of Size onto Kind, Escape, then released back on Size left the order and the sort as they
  were; without the swallow the release sorted Size. The listeners are removed in `ended`, so an
  Escape after a move has ended does nothing.
- **The handle's press never reaches the cell**: `startResize` stops its propagation, which is all
  that keeps a border drag from also being a move.

## Code

- `src/hooks/useColumnMove.ts` — `useColumnMove`, `ColumnMoveOptions`, `ColumnMoveDrag`, `ColumnMoving`, `moveSlot`
- `src/components/TableHeader.tsx` — `move`, `onColumnKeyDown`, `rowRef`, `data-table-move-indicator`, `data-table-moving`
- `example/FileTable.tsx` — `GHOST`, `MoveFeedback` (the `?ghost` page)
- `src/lib/tableModel.ts` — `withOrder`, `columnOrder`, `moveTargets`, `moveBy`, `moved`
- `src/types.ts` — `ColumnLayout.order`, `ColumnSpec.movable`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  `refusePress`, `threshold` and `targets` are required inside `move`, and which columns move is the
  spec's.
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

- **No edge scroll.** A column dragged past the header's edge does not scroll the grid. Since #74
  `onDrag` reports the pointer and the scroller, so a consumer's loop can, as for the border drag;
  the example runs none for a move.
- **The drag is mouse only**, as every drag here; the keyboard moves a column through
  `onColumnKeyDown` and `moveBy`.
- **Firefox and Safari not measured** for the focus a move keeps; the restore is React's, not the
  browser's, so it should hold, but nothing here has run there.
