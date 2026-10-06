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
  arrives was not decided. **The premise is gone**: since #47 `measure` does not call it at all, and
  `marqueeScale` — itself built on it — is its only caller. Where it lives, and what `marqueeScale`
  is called, were deferred to #48 by the maintainer (2026-10-01, #47's triage). #48 kept it here
  and moved `marqueeScale` in beside it as `longScale`, with `canvasOffset` (the maintainer's calls
  in #48's triage), so the module now holds the scale and the offset the row window and the marquee
  both measure with.
- **The canvas's offset is computed by one function, in the marquee's order of operations** — the maintainer's
  call, 2026-10-06 (#48), over the row window's order, which would have changed `marqueeFrame`'s
  input. `canvasOffset` takes the canvas's edge less the view's inner edge — the border already in
  it, at the scale — divides by the scale and adds the scroll. Shown: the two former forms are
  equal in algebra and differ in their last bits only where the scroller has a border and the scale
  is inexact — in 8–24 % of 100,000 random inputs under `scale(0.83)` and `scale(0.37)` with a 1 or
  2 px border, in none with no border or at `scale(1)` or `scale(0.5)` — and then by about
  10⁻¹² px. So the marquee's results are unchanged to the bit, and the row window's are unchanged
  to the bit wherever the scroller has no border or the scale is exact, and otherwise within
  10⁻⁹ px: the triage's "unchanged, to the bit" was relaxed to that. Theirs to reverse. What the
  call did not cover: the view edge `canvasOffset` is handed is folded in two places, by
  `marqueeView` for the marquee and by `canvasTopOf` for the row window — the same sum,
  `box + border × scale`, which #48 created, since the hook used to subtract the border in layout
  px after dividing. Sharing it means changing `marqueeView`, which #48 left alone.
- **The row height is read in layout px, from the row's computed height** — the maintainer's call in
  triage, 2026-10-01 (#47), over a tolerance on the box comparison and over doing both. Shown: a
  static page in Chrome, absolutely placed 28 px rows in a scroller under a transform, sampled at 66
  scroll depths — the screen height divided by the scale gave one value under `scale(1)` and
  `scale(0.5)` and three to five under `scale(0.54)`, `(0.37)`, `(0.7)` and `(0.83)`, spread
  27.999997–28.000005, while the computed height gave 28 at every depth and every scale. Theirs to
  reverse.
- **The padding and borders are added only where `box-sizing` is `content-box`** — a derivation,
  measured rather than reasoned, and it falls to a better measurement. The triage call named the
  rule but its three measured rows were all content-box or had no vertical padding or border, so
  none of them told it from an unconditional sum. Measured 2026-10-06 in Chrome, on the rows that
  do tell them apart: a `border-box` row of `height: 28px` with a 1 px bottom border, and one with
  4 px of vertical padding, both compute `height` as **`28px`** — Chrome resolves `height` to the
  border box where `box-sizing` is `border-box`, not to the content box. So an unconditional sum
  reads such a row 1 px and 8 px too tall. A `content-box` row of `height: 26px` with 1 px borders
  computes `26px` and needs the sum. Held in a browser by `check:example` since #50
  ([verification gates](verification-gates.md)). The jsdom test holds the rule but not the browser
  fact it rests on, since jsdom hands back the `height` it was given.
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
- **The row height is read in layout px, never on screen (#47).** `rowLayoutHeight` takes the
  sampled row's computed `height` — which no transform touches — and adds its vertical padding and
  borders only where `box-sizing` is `content-box`, since `height` resolves to the border box
  otherwise (#47, above). A height that is not a positive number is no measurement and the
  `rowHeightRem` fallback applies, which is layout px already. No scale enters it, so nothing about
  the row moves when the grid is scaled. Until #47 the row was read with `getBoundingClientRect`,
  after the transform, and divided by `screenScale`; that quotient is what never settled. See
  [lengths are layout px](../invariant/lengths-are-layout-px.md).
- **So the box comparison is strict, and may be.** `measure` compares `rowHeight` with `===`. That
  was #19's and it was wrong while the reading came off the screen: a row's screen height moves with
  its sub-px position, so the quotient wobbled and each reading was a new box, a new render and a new
  measurement. In Chrome, 5,000 rows under `scale(0.83)` alternated 28.0000257 ↔ 27.9999889 at each
  `measure`, 52 `setBox` calls in ten frames, until React threw *Maximum update depth exceeded*; so
  did `scale(0.37)`, while `scale(1)` and `scale(0.5)` settled (2026-10-01, while #46 was built).
  `TableGrid.test.tsx` feeds a row's screen height half that pair, alternating, and requires the
  grid to settle. The computed height does not move, so the strict comparison is now exactly right
  rather than merely cheap. The offset keeps its 1 px threshold (#46), because it is still a screen
  distance.
- **A scale within a px of 1 is exactly 1.** `offsetHeight` is a whole px, so the ratio of an
  unscaled scroller is not 1: the example's is 654.203125 over 654 in Chrome. Snapping keeps an
  unscaled grid's readings identical to the lengths themselves. Under a scale the ratio is exact only
  to half a px of the scroller's height, which is why a distance longer than the element measured
  takes the longer one (`longScale`, below). Before #47 this bounded the row too: the unsnapped
  ratio placed rows 27.991 apart instead of 28, and under `scale(0.5)` the example placed them
  27.9913 apart on a canvas of 139,957 px against 140,000 unscaled. Under a transform both are now
  exact: step 28 and canvas 140,000 under `scale(0.5)`, step 28 at six depths under `scale(0.37)`
  and `scale(0.83)` (Chrome, 2026-10-06). Not under CSS `zoom` (`## Known holes / open`).
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
  `measure` takes the canvas's client top less the scroller's inner top on screen — its box top
  plus its top border at the scale — divides by the scale and adds `scrollTop`: `canvasOffset`,
  which the marquee's frame uses too (#48). That screen distance grows with the scroll, so it is
  divided by `longScale` — the scale over the longer of the scroller and the canvas — not by the
  scroller's own ratio: under `scale(0.5)`, a reveal deep in the
  example's 5,000 rows landed 43 px off with the scroller's ratio and 0 with the longer one (Chrome,
  2026-10-01). The reading still moves with the scroll by a fraction of a px — under `scale(0.83)`,
  83.95 against 84.10 — and a new offset is a new `box` and a render, which measures again; a
  reading that alternates renders without end, which is what the row height did under some scales
  until #47 read it off the layout instead. So `measure` keeps the old offset while the new one is within 1 px; with
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

- `src/lib/rowWindow.ts` — `visibleRange`, `scrollToReveal`, `screenScale`, `longScale`, `canvasOffset`, `BLOCK_ROWS`, `UNMEASURED_ROWS`, `VisibleRangeInput`, `RevealInput`, `LongScaleInput`, `CanvasOffsetInput`
- `src/types.ts` — `RowWindow`
- `src/hooks/useRowWindow.ts` — `useRowWindow`, `measure`, `rowLayoutHeight`, `lengthPx`, `canvasTopOf`, `RowBox` (`canvasTop` included), `RowWindowInput`, `RowWindowState`, `rowHeightRemRef`, `notARowRef`, `scrollTopRef`, `boxRef`, `rangeRef`, `redraw`
- `src/components/TableGrid.tsx` — `TableGrid`, `canvasRef`, `rowKey`

## Reference behaviour

**None.** in this repository. PenTerm's `explorer-block.md` § Reference behavior records electerm
(spacer windowing, rejected) and VS Code's list (absolutely placed rows, no spacers, no overscan —
followed), with the `left: 0` trap found against it.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `visibleRange`,
  `scrollToReveal`, `screenScale`, `rowLayoutHeight` and `measure` each treat a zero or unparsable
  length as absent.
- [Lengths are layout px](../invariant/lengths-are-layout-px.md) — `measure` reads the row's height
  in layout px (#47) and converts the canvas's screen offset before either enters `box`.
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
- [Marquee](marquee.md) — depends on this module since #48: it takes its scale from `longScale` and
  its frame's offsets from `canvasOffset`, which `measure` uses for the canvas's top. A change to
  either moves the marquee's hit-test and the row window's offset, window and reveals together.
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
  fire on a transform, and `measure` runs on commit; #19 left an observer for it out. Since #47 the
  row height is not among what a new scale moves — it is read off the layout — but the canvas's
  offset still is. The same holds for a root font-size change, which does move the row height without
  resizing the scroller. Since #32
  a scroll inside a block is no longer a render, so such a change waits for a scroll that moves the
  window, a new `focus`, or a render from the consumer; before, any scroll step picked it up. #32's
  calls did not cover this, and #34 kept measuring after every commit on cost alone (below), so
  this gap is open.
- **Only a scale is corrected.** The ratio is taken from heights, so a scale on the vertical axis is
  what it measures; under a rotation or a skew the bounding rect is the box that encloses the element,
  and the ratio is not the scale. A real scale that moves the scroller's height by less than a px is
  snapped away. Since #47 this binds only the canvas's offset, the one reading still taken on screen.
- **The marquee measures its scale with `screenScale` too, on the longer of the scroller and the
  canvas** (#28): the scroller's ratio, exact to half a px of its height, drifted rows when divided
  into a distance as long as the scroll ([marquee](marquee.md)). `measure` uses that same longer
  ratio for the canvas's offset, and since #47 divides nothing else.
- **Under CSS `zoom` the row height is not the specified one.** Chrome lays a zoomed subtree out in
  zoomed px and divides the computed values back, so a 28 px row computes as 27.9932 under
  `zoom: 0.83` and 27.9983 under `zoom: 0.37`, while its `offsetHeight` says 28. Measured
  2026-10-06 on the example swept to six depths: one value per zoom at every depth, no page error,
  rows placed at that pitch — so no loop, and no gap a row could show, since the rows are drawn at
  the pitch they are laid out at. The screen reading before #47 was not 28 either (27.9756 on a
  static page under `zoom: 0.83`). `zoom` was never among what this corrects (above); recorded so
  that the transform's exact 28 is not read as a promise for it.
