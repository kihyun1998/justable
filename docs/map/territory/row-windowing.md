# Row windowing

## What it is

Drawing only the rows the viewport can see: which index range is drawn (`visibleRange`), where to
scroll to bring a row fully into view (`scrollToReveal`), and `useRowWindow`, the grid's hook that measures
the scroller and a row, places the drawn rows on a canvas as tall as all of them, and keeps both in
step with scrolling and resizing. The arithmetic is pure and in `rowWindow.ts`; the hook supplies
the measurements, and `TableGrid` draws what it answers.

## Governing decisions

- **The grid works out its own scale** — the maintainer's call, 2026-09-30 (#19), over taking a
  `scale` prop as column resize does. It deliberately differs from [column resize](column-resize.md);
  unifying the two was left out. Rounding the row through its own `offsetHeight` was rejected: a
  fractional row height would come out whole.
- **The scale's layout side is the scroller's `offsetHeight`, snapped to 1 within a px** — the
  maintainer's call, 2026-09-30 (#19). Shown: the example's scroller measured in Chrome, 654.203125 on
  screen against an `offsetHeight` of 654 unscaled (a ratio of 1.00031, which moved the unscaled row
  step from 28 to 27.991), and 327.1015625 against 654 under `scale(0.5)`; and three options — this
  one; the unrounded `getComputedStyle` height with the same snap (27.99999 under `scale(0.5)`, at the
  cost of a box-sizing sum, since the package ships no preflight); and `offsetHeight` with no snap
  (the unscaled output changes). Theirs to reverse.
- **`screenScale` stays in `rowWindow.ts` while `useRowWindow`'s `measure` is its only caller** — the maintainer's
  call, 2026-09-30 (#19), over a module of its own now. Shown: the review's point that it is a
  general screen-to-layout ratio, and that #28 would be its second caller. Where it goes when #28
  arrives was not decided.
- **The row window measures on its own** — the maintainer's call, 2026-09-30 (#25's triage), over
  one effect calling the row window and the [header lane](header-lane.md) in a fixed order: each hook
  attaches its own layout effect and its own `ResizeObserver`. What that costs, and the order the two
  keep, is recorded in the header lane's note, which carries the duplicated guard.
- **The grid renders only when what it draws changes, fixed in code** — the maintainer's call in
  triage, 2026-09-30 (#32), over correcting this note to say a scroll step renders and the blocks
  save only DOM work. Shown: a jsdom `Profiler` over 5,000 rows, a 280 px viewport and 28 px rows,
  400 scroll steps of 25 px, on `main` at `40f9934` — 400 `update` commits from the scroll offset as
  state, 400 `nested-update` commits from `setBox`'s updater, 27,872 `renderRow` calls (about twice
  the ~35 drawn rows a step), 400 measurements; and the issue's headless Chrome count of 400 commits
  on the example's grid. Two more calls the same day: **the box is still measured after every
  commit** (narrowing was #34's, declined below), and **the change lands inside #25's
  `useRowWindow`**. The
  calls did not cover that fewer commits mean fewer measurements — see `## Known holes / open`.
  Theirs to reverse.
- **The box is measured after every commit, not narrowed** — the maintainer's call in triage,
  2026-10-01 (#34, closed `wontfix`, `.out-of-scope/measuring-the-box-less-often.md`). Shown: Chrome
  on the example grid, 20 root font-size steps each with a commit — one layout a step, forced in the
  commit and none in the frame, 18.5 and 21.1 ms with `measure` after every commit against 20.2 and
  18.7 ms with it only at mount; a font-size step with no commit also cost one layout, in the frame.
  So `measure`'s layout is moved, not added. Not shown: WebView2 or PenTerm's own path, where no
  other read forces layout in the commit. The call did not cover picking up a scale or font-size
  change made with no render (`## Known holes / open`). Theirs to reverse.
- **The canvas's offset is an optional input of both public functions** — the maintainer's call in
  triage, 2026-10-01 (#46), over keeping `visibleRange` and `scrollToReveal` as they were and
  converting in `useRowWindow` alone. Shown: both are exported, PenTerm imports `visibleRange`, and
  the hook-only option leaves the exported functions assuming the canvas starts at 0. `canvasTop`
  defaults to 0, so a call without it answers as before. The name was the agent's. Theirs to reverse.
- **Revealing row 0 scrolls to 0, showing the rows above the canvas** — the maintainer's call in
  triage, 2026-10-01 (#46), over strict nearest edge, which stops at `canvasTop` and leaves the
  leading rows scrolled out. Shown: before #46 this already happened, only through `Math.max(0, top)`
  with the offset ignored; a file list's `..` row is the case. It covers row 0 revealed upward and
  nothing else: a row 0 already wholly in view with the leading rows scrolled out is not moved.
  Theirs to reverse.
- **…only while row 0 then fits; otherwise to row 0's own top edge** — the maintainer's call,
  2026-10-01, while #46 was built. The triage call was not shown a viewport shorter than the
  leading rows plus a row: a completeness pass found `scrollToReveal(0, { scrollTop: 400,
  viewportHeight: 50, rowHeight: 28, canvasTop: 84 })` answering 0, which leaves row 0 at 84–112,
  below the view, and the reveal does not run again — against the function's own "fully into view".
  `main` did the same. Shown: this rule, against keeping 0 always and recording the exception.
  Theirs to reverse.
- **A change of the canvas's offset alone does not reveal** — the maintainer's call, 2026-10-01,
  while #46 was built, over revealing on any change of `box`. Shown, in Chrome: focus on row 39,
  the list scrolled to 0, a second leading row added — the first version (offset in `box`, reveal
  on `[focus, box]`) pulled the list to 904, `main` left it at 0; and PenTerm's new folder, which
  adds a `#new` leading row without clearing the focus, so the input row just drawn would leave the
  view. The cost, accepted: a focused row at the bottom edge is pushed below it when a leading row
  appears, as on `main`, until the next move. Theirs to reverse.
- **The drawn window's shift is fixed under #46 with the reveal** — the maintainer's call in triage,
  2026-10-01, over a separate issue: one root, one measurement, one site.
- **The README promises nothing about scaled copies** — the maintainer's call, 2026-09-30 (#19). A
  paragraph saying a scaled grid needs no prop and picks up a new scale at its next render was
  written and removed: the second half is a known hole below, not a contract. The CHANGELOG records
  the fix.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **First paint was the cost, not scrolling.** Unwindowed, 5,000 rows took 3,003 ms to draw (about
  0.6 ms a row) while scrolling stayed at 60 fps (PenTerm).
- **The scroll offset is a ref, and the box is state.** The scroll handler writes the offset into
  `scrollTopRef`; `box` (viewport height, row height) is set only from `measure`. The first version
  read `getComputedStyle` and `getBoundingClientRect` in the scroll handler, and both force style and
  layout on every scroll event (`penterm 5bf00320d`). **No frame-time number supports this** — see
  `## Known holes / open`.
- **The window is computed in render, from the offset now.** `range` is `visibleRange` over
  `scrollTopRef`, `box` and `total` on every render, so a render for any reason — a new box, a new
  `total`, a new `focus` — draws the window for where the scroller is, not where it was at the last
  render. Holding the window as state instead would draw a stale one for a render: after a scroll
  inside a block, a new row height puts the current offset and the last drawn one in different
  blocks (3,100 and 3,000 px at 16 px rows: rows 192 and 184), and a shrunk `total` would hand
  `renderRow` indices past the end.
- **A scroll renders only when the window moves (#32).** `onScroll` computes the window for the new
  offset against `boxRef` and `totalRef` and calls `redraw` only when its `start` or `end` differs
  from `rangeRef`, the window last rendered. At 25 px steps and 28 px rows that is about one step in
  nine: in Chrome, on the example's grid (a 654 px viewport), 400 such steps ran `measure` — once a
  commit — 44 times, once for each of the 44 windows drawn, against 400 on `main` (2026-10-01).
  `rangeRef` is written during render, as `rowHeightRemRef` is. Everything else that follows the scroll reads the element, not a render: the reveal effect,
  the [marquee](marquee.md)'s hit-test, and the [header lane](header-lane.md)'s horizontal follow,
  which the same `onScroll` in `TableGrid` writes to the DOM on every step.
- **`measure` runs after every commit and on every resize, and changes state only when the box
  changed.** A `useLayoutEffect` with no dependency list calls it each commit; it compares the new
  box with `boxRef` and calls `setBox` only when they differ. Comparing inside a `setBox` updater
  instead (as before #32) renders the grid a second time on most commits: React runs an updater
  ahead of a render only while the component has no update pending, and after a commit of the
  grid's own update it has one, so it renders to find the box unchanged. Measured in jsdom on
  `main`: a `nested-update` after each of 400 scroll steps, after every second rerender from the
  parent, and a second one at mount. A `ResizeObserver` attached once calls `measure` too; it reads
  only refs (`rowHeightRemRef`, `boxRef` included), so the first closure never goes stale.
- **The row height is measured from a drawn row, never assumed** — the canvas's first child, unless
  that is the [marquee](marquee.md)'s rectangle. It follows the app's root font size
  and row density — 28 px at a 16 px root, 42 px at 24 px (PenTerm). `rowHeightRem` × the root font
  size (16 if unparsable) covers only frames before a row exists.
- **The row height is in layout px**, whatever transform scales the grid on screen. The row is read
  with `getBoundingClientRect`, which is after the transform, while `clientHeight`, `scrollTop` and a
  row's `top` are before it; so `measure` divides the row by `screenScale` — the scroller's screen
  height over its `offsetHeight` — and every consumer of `box` works in one unit without being
  touched. The `rowHeightRem` fallback is layout px already and is not divided. See
  [lengths are layout px](../invariant/lengths-are-layout-px.md).
- **A scale within a px of 1 is exactly 1.** `offsetHeight` is a whole px, so the ratio of an
  unscaled scroller is not 1: the example's is 654.203125 over 654 in Chrome, which would place rows
  27.991 apart instead of 28. Snapping keeps an unscaled grid's `box` identical to what the row
  measures. Under a scale the ratio is exact only to half a px of the scroller's height: under
  `scale(0.5)` the example places rows 27.9913 apart and draws a canvas of 139,957 px against 140,000
  unscaled — 0.008 screen px of overlap a row, the same window and the same page.
- **A zero viewport is no measurement.** `box` stays `null`, rows flow unpositioned and the window is
  the first `UNMEASURED_ROWS` (200, about 120 ms to draw in PenTerm) — a cap, not a guess at what
  fits. Windowing against a zero height would draw one row. See
  [zero is no measurement](../invariant/zero-is-no-measurement.md).
- **The row-height guard is written `!(rowHeight > 0)`, not `rowHeight <= 0`.** `NaN` compares false
  both ways, so only the negated form sends it to the unmeasured branch; rewriting it the natural way
  lets `NaN` through to the division.
- **The window moves in blocks**, so a one-row scroll usually changes nothing and, since #32,
  costs no React render: the first row is snapped down to a multiple of `BLOCK_ROWS` (8) and a whole block is drawn
  past each edge: `start = snapped − 8`, `end = snapped + span + 16`. The block past the edge is also
  so a drag's edge-scroll step hit-tests a drawn row before the re-render lands.
- **A consumer's suite depends on that margin.** PenTerm's drag edge-scroll moves up to 48 px a frame
  (`EDGE_SCROLL_MAX_STEP`), and its `edgeScrollStaysInTheWindow.test.ts` imports `visibleRange` from
  this package and checks that step against it. `rowWindow.test.ts` holds the same 48 px here, so
  shrinking the block past the edge fails here first rather than only in the consumer.
- **Edges are inclusive on purpose.** `floor` on the first row keeps the row straddling the top edge;
  the span is `ceil(viewport / row) + 1`, so a viewport that is an exact multiple still shows the next
  row's top border. The snapped start is clamped to `total − 1`.
- **Two origins: the canvas and the scroller's content (#46).** A drawn row's `top` is measured from
  the canvas; `scrollTop` from the top of the scroller's content, which holds the leading rows
  above the canvas. So data row `i` sits at `canvasTop + i × rowHeight` in the scroller, and both
  `visibleRange` (`first = floor((scrollTop − canvasTop) / rowHeight)`) and `scrollToReveal` take
  `canvasTop`. Before #46 neither did: revealing downward stopped `canvasTop` short — in Chrome, a
  row reached at the bottom stayed 28 px below the view under one 28 px leading row and 84 px under
  three — and the window was shifted down by `canvasTop / rowHeight` rows, which the block past the
  edge hid up to eight rows; under twelve, 33 of 129 scroll offsets left the top visible row undrawn.
  The [marquee](marquee.md) took the canvas as its origin from the start.
- **The offset is measured with the box, over the longer element, and a sub-px move is no change.**
  `measure` takes the canvas's client top less the scroller's, divided by the scale, less the
  scroller's top border, plus `scrollTop`. That screen distance grows with the scroll, so it is
  divided by `marqueeScale` — the scale over the longer of the scroller and the canvas — not by the
  scroller's own ratio, which the row height uses: under `scale(0.5)`, a reveal deep in the
  example's 5,000 rows landed 43 px off with the scroller's ratio and 0 with the longer one (Chrome,
  2026-10-01). The reading still moves with the scroll by a fraction of a px — under `scale(0.83)`,
  83.95 against 84.10 — and a new offset is a new `box` and a render, which measures again; a
  reading that alternates would render without end, as the row height does under some scales
  (`## Known holes / open`). So `measure` keeps the old offset while the new one is within 1 px; with
  a strict comparison, jsdom fed an offset 0.4 px apart at every second reading throws React's
  *Maximum update depth exceeded*. A scroller with no height on screen (jsdom) answers 0 rather than
  a distance from a box that was never laid out.
- **Drawn rows are absolutely placed** at `index × rowHeight` on a canvas `total × rowHeight` tall,
  with `left: 0` **and** `right: 0`. With `left` alone a placed row shrinks to fit and the filler
  track collapses — measured header tracks `510 120 112 128` against row tracks `96 120 112 128`
  (PenTerm). Before measurement the placement style is `undefined` and rows flow.
- **Rows are keyed by the consumer's identity** (`rowKey`), so a re-sort moves a row's DOM and state
  with it instead of handing an index's state to another row.
- **Revealing a row is arithmetic.** Under windowing the focused row may have no element to scroll
  into view. `scrollToReveal` returns the `scrollTop` that shows it whole — to the top edge going up,
  to the bottom edge going down, so a one-row move does not jump the list; row 0 going up to 0, so
  the leading rows show with it (#46, above) — or `null` if it already is
  (a straddling row is not visible: half a row is not readable, and the key that just landed there
  has to show what it landed on). Row 0 goes to 0 only where it then fits, else to its own top edge.
  The effect runs on `focus` and the box's viewport and row heights — not on its `canvasTop` (#46,
  above) — and reads the offset from the element, not from state, so a scroll alone does not re-run
  it and pull the list back.
- **The page size the keyboard moves by is written here.** When `box` changes, the grid writes
  `floor(viewportHeight / rowHeight)` into the keyboard hook's `link.rowsPerPage`.

## Code

- `src/lib/rowWindow.ts` — `visibleRange`, `scrollToReveal`, `screenScale`, `BLOCK_ROWS`, `UNMEASURED_ROWS`, `VisibleRangeInput`, `RevealInput`
- `src/types.ts` — `RowWindow`
- `src/hooks/useRowWindow.ts` — `useRowWindow`, `measure`, `canvasOffset`, `RowBox` (`canvasTop` included), `RowWindowInput`, `RowWindowState`, `rowHeightRemRef`, `notARowRef`, `scrollTopRef`, `boxRef`, `rangeRef`, `redraw`
- `src/components/TableGrid.tsx` — `TableGrid`, `canvasRef`, `rowKey`

## Reference behaviour

**None.** in this repository. PenTerm's `explorer-block.md` § Reference behavior records electerm
(spacer windowing, rejected) and VS Code's list (absolutely placed rows, no spacers, no overscan —
followed), with the `left: 0` trap found against it.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `visibleRange`,
  `scrollToReveal`, `screenScale` and `measure` each treat a zero or unparsable length as absent.
- [Lengths are layout px](../invariant/lengths-are-layout-px.md) — `measure` converts the row's
  screen height before it enters `box`.
- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — the
  `right: 0` is what keeps a placed row's filler track as wide as the header's.
- [Row one is the header](../invariant/row-one-is-the-header.md) — the window is in data-row
  indices; the grid adds the offset when it hands out `rowIndex`.

## Blast radius

- [Grid scaffold](grid-scaffold.md) — `aria-activedescendant` is present only while the focused row
  is inside the window this computes.
- [Header lane](header-lane.md) — shares the scroller, the scroll event (`TableGrid`'s `onScroll`
  hands each hook its axis), the width hold's release (which runs `measure` before the lane's), and a
  read order: `useRowWindow` is called first, so the box is read before the spacer is written.
- [Keyboard movement](keyboard-movement.md) — its page size comes from this box, and its focus
  changes are revealed by this effect.
- [Marquee](marquee.md) — `measure` calls its `marqueeScale` for the canvas's offset; a change to
  that function moves the offset, and with it the window and every reveal.
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
- **A scale changed with no re-render is picked up at the next render.** A `ResizeObserver` does not
  fire on a transform, and `measure` runs on commit; #19 left an observer for it out. The same holds
  for a root font-size change, which moves the row height without resizing the scroller. Since #32
  a scroll inside a block is no longer a render, so such a change waits for a scroll that moves the
  window, a new `focus`, or a render from the consumer; before, any scroll step picked it up. #32's
  calls did not cover this, and #34 kept measuring after every commit on cost alone (below), so
  this gap is open.
- **Under some scales the box never settles, on `main` before #46 too.** In Chrome, 5,000 rows under
  `scale(0.37)` or `scale(0.83)` and a deep scroll or reveal throw React's *Maximum update depth
  exceeded*: the measured row height alternates between 28.0000257 and 27.9999889 on each `measure`,
  and the strict comparison takes each as a new box. Unscaled and under `scale(0.5)` it does not
  happen. Measured 2026-10-01 while #46 was built; #46's offset stays within its 1 px and is not
  part of it. Not fixed: the row height's comparison is #19's.
- **Only a scale is corrected.** The ratio is taken from heights, so a scale on the vertical axis is
  what it measures; under a rotation or a skew the bounding rect is the box that encloses the element,
  and the ratio is not the scale. A real scale that moves the scroller's height by less than a px is
  snapped away.
- **The marquee measures its scale with `screenScale` too, on the longer of the scroller and the
  canvas** (#28): the scroller's ratio, exact to half a px of its height, drifted rows when divided
  into a distance as long as the scroll ([marquee](marquee.md)). The row height here only divides a
  row's own height, so the scroller's ratio is enough for it.
