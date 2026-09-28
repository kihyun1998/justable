# Row windowing

## What it is

Drawing only the rows the viewport can see: which index range is drawn (`visibleRange`), where to
scroll to bring a row fully into view (`scrollToReveal`), and the part of `TableGrid` that measures
the scroller and a row, places the drawn rows on a canvas as tall as all of them, and keeps both in
step with scrolling and resizing. The arithmetic is pure and in `rowWindow.ts`; the grid supplies
the measurements.

## Governing decisions

**None.**

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **First paint was the cost, not scrolling.** Unwindowed, 5,000 rows took 3,003 ms to draw (about
  0.6 ms a row) while scrolling stayed at 60 fps (PenTerm).
- **Scroll position and box size are separate state.** `scrollTop` is set from the scroll handler;
  `box` (viewport height, row height) only from `measureBox`. The first version read
  `getComputedStyle` and `getBoundingClientRect` in the scroll handler, and both force style and
  layout on every scroll event (`penterm 5bf00320d`). **No frame-time number supports this** — see
  `## Known holes / open`.
- **`measureBox` runs after every render and on every resize.** A `useLayoutEffect` with no
  dependency list calls it each commit, and `setBox` returns the previous object when nothing changed,
  so an unchanged measurement costs no re-render. A `ResizeObserver` attached once calls it too; it
  reads only refs (`rowHeightRemRef` included) and calls `setBox`, so the first closure never goes
  stale.
- **The row height is measured from a drawn row, never assumed.** It follows the app's root font size
  and row density — 28 px at a 16 px root, 42 px at 24 px (PenTerm). `rowHeightRem` × the root font
  size (16 if unparsable) covers only frames before a row exists.
- **A zero viewport is no measurement.** `box` stays `null`, rows flow unpositioned and the window is
  the first `UNMEASURED_ROWS` (200, about 120 ms to draw in PenTerm) — a cap, not a guess at what
  fits. Windowing against a zero height would draw one row. See
  [zero is no measurement](../invariant/zero-is-no-measurement.md).
- **The row-height guard is written `!(rowHeight > 0)`, not `rowHeight <= 0`.** `NaN` compares false
  both ways, so only the negated form sends it to the unmeasured branch; rewriting it the natural way
  lets `NaN` through to the division.
- **The window moves in blocks**, so a one-row scroll usually changes nothing and costs no React
  render: the first row is snapped down to a multiple of `BLOCK_ROWS` (8) and a whole block is drawn
  past each edge: `start = snapped − 8`, `end = snapped + span + 16`. The block past the edge is also
  so a drag's edge-scroll step hit-tests a drawn row before the re-render lands.
- **A consumer's suite depends on that margin.** PenTerm's drag edge-scroll moves up to 48 px a frame
  (`EDGE_SCROLL_MAX_STEP`), and its `edgeScrollStaysInTheWindow.test.ts` imports `visibleRange` from
  this package and checks that step against it. `rowWindow.test.ts` holds the same 48 px here, so
  shrinking the block past the edge fails here first rather than only in the consumer.
- **Edges are inclusive on purpose.** `floor` on the first row keeps the row straddling the top edge;
  the span is `ceil(viewport / row) + 1`, so a viewport that is an exact multiple still shows the next
  row's top border. The snapped start is clamped to `total − 1`.
- **Drawn rows are absolutely placed** at `index × rowHeight` on a canvas `total × rowHeight` tall,
  with `left: 0` **and** `right: 0`. With `left` alone a placed row shrinks to fit and the filler
  track collapses — measured header tracks `510 120 112 128` against row tracks `96 120 112 128`
  (PenTerm). Before measurement the placement style is `undefined` and rows flow.
- **Rows are keyed by the consumer's identity** (`rowKey`), so a re-sort moves a row's DOM and state
  with it instead of handing an index's state to another row.
- **Revealing a row is arithmetic.** Under windowing the focused row may have no element to scroll
  into view. `scrollToReveal` returns the `scrollTop` that shows it whole — to the top edge going up,
  to the bottom edge going down, so a one-row move does not jump the list — or `null` if it already is
  (a straddling row is not visible: half a row is not readable, and the key that just landed there
  has to show what it landed on). The effect runs on `[focus, box]` and reads the offset from the
  element, not from state, so a scroll alone does not re-run it and pull the list back.
- **The page size the keyboard moves by is written here.** When `box` changes, the grid writes
  `floor(viewportHeight / rowHeight)` into the keyboard hook's `link.rowsPerPage`.

## Code

- `src/lib/rowWindow.ts` — `visibleRange`, `scrollToReveal`, `BLOCK_ROWS`, `UNMEASURED_ROWS`, `VisibleRangeInput`, `RevealInput`
- `src/types.ts` — `RowWindow`
- `src/components/TableGrid.tsx` — `TableGrid`, `measureBox`, `rowHeightRemRef`, `canvasRef`, `rowKey`

## Reference behaviour

**None.** in this repository. PenTerm's `explorer-block.md` § Reference behavior records electerm
(spacer windowing, rejected) and VS Code's list (absolutely placed rows, no spacers, no overscan —
followed), with the `left: 0` trap found against it.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `visibleRange`,
  `scrollToReveal` and `measureBox` each treat a zero or unparsable length as absent.
- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — the
  `right: 0` is what keeps a placed row's filler track as wide as the header's.
- [Row one is the header](../invariant/row-one-is-the-header.md) — the window is in data-row
  indices; the grid adds the offset when it hands out `rowIndex`.

## Blast radius

- [Grid scaffold](grid-scaffold.md) — `aria-activedescendant` is present only while the focused row
  is inside the window this computes.
- [Header lane](header-lane.md) — shares `measureBox`: the lane's gutter padding is written in the
  same function, before the zero-height early return.
- [Keyboard movement](keyboard-movement.md) — its page size comes from this box, and its focus
  changes are revealed by this effect.
- [Table row](table-row.md) — the placement arrives in the row's `style`, which it must merge under
  the grid template rather than replace.

## Known holes / open

- **The frame-time case for blocks and for separate state is unmeasured, and the number that claims
  otherwise is withdrawn.** "p95 18 ms → 51–58 ms" is in PenTerm's note, and was in
  `rowWindow.test.ts` until this map found it, attributed once to measuring in the scroll handler and once to re-rendering on every crossed
  row. Both come from `penterm 5bf00320d`, whose own message says *"What is not claimed is a
  frame-time number"*: five runs of one build gave p95 of 17.7, 56.6, 29.6, 18.9 and 43.3 ms. What
  that commit does claim is the draw-time effect — 3,003 ms to 47 ms. Neither the value 8 nor the
  choice to snap has a measurement behind it.
- **`UNMEASURED_ROWS`' cost (about 120 ms) is PenTerm's note's figure**, on one machine in one app; a
  consumer with heavier cells moves it.
- **Variable row heights are not supported.** Every row is placed at `index × rowHeight` from one
  measured row.
