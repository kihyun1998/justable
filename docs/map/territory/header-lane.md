# Header lane

## What it is

The non-scrolling strip the header sits in, above the scroller, and the two things that keep it
aligned with the rows below: it follows the rows' horizontal scroll, and it reserves the same right
gutter the scroller's vertical scrollbar takes. It is the reason the vertical scrollbar starts under
the header rather than beside it.

## Governing decisions

- **The empty gutter is padded, measured** — the maintainer's call, 2026-09-30 (#22), over
  `overflow-y: scroll` (an empty track always drawn), over dropping `scrollbar-gutter` (the frame where
  rows narrow under the header comes back) and over recording it without a fix. The pad is the
  shortfall the engine shows, never assumed from the gutter width: a pad sized to the gutter was
  measured to over-scroll Firefox 147 by that amount.
- **The engine probe lives in `TableGrid.tsx`** — the maintainer's call, 2026-09-30 (#22), over a file
  of its own (`src/components/emptyGutter.ts`), so the file layout is left to #25's split. Settled by
  #25, below.
- **The lane measures on its own** — the maintainer's call, 2026-09-30 (#25's triage), over one
  shared effect calling the row window and the lane in a fixed order: `useHeaderLane` attaches its own
  layout effect and its own `ResizeObserver`, as [row windowing](row-windowing.md)'s hook does.
- **The spacer is still not touched at zero height** — the maintainer's call, 2026-09-30 (#25's
  triage), over running it at any height. Because the lane measures on its own, it carries its own
  guard: the gutter is written whatever the height, and the spacer is left alone while the scroller's
  `clientHeight` is 0. It is the one guard the split duplicates, and a site of
  [zero is no measurement](../invariant/zero-is-no-measurement.md).
- **The engine probe and the width hold live in the lane hook's module**, not in files of their own —
  the maintainer's call, 2026-09-30 (#25's triage). `GridScroller` stays the context type the header
  receives, in `gridScroller.ts`.
- **The two hooks are `src/hooks/useRowWindow.ts` and `src/hooks/useHeaderLane.ts`** — the
  maintainer's call, 2026-09-30 (#25), over putting the lane's hook beside `gridScroller.ts` as
  `src/components/headerLane.ts`. Shown: `useMarquee`, an internal hook of the grid's, already in
  `src/hooks/`. Neither is exported from `src/index.ts`. Theirs to reverse.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **The lane is `overflow-x: clip`, not `hidden`.** `hidden` on one axis forces the other to `auto`
  (measured in PenTerm), which would let the lane scroll vertically.
- **`clip` is not a scroll container, and that costs two things.**
  - `scrollLeft` on the lane does nothing, so the lane's inner box follows the rows by
    `translateX(−scrollLeft)` written **in the scroller's scroll handler, directly on the DOM**.
    Through state the header trails the rows by a frame.
  - `scrollbar-gutter` reserves nothing on it, so the lane's `paddingRight` is set by hand to the
    scroller's `offsetWidth − clientWidth` (0 against 15 px on a classic scrollbar, PenTerm).
- **React never writes either property.** Both are imperative writes on elements whose JSX sets no
  `style` — an inline style is a diff, and two owners of one property lose silently.
- **The gutter is measured even without a box.** `useHeaderLane`'s `measure` writes the lane's
  padding at any height, and skips only the spacer at zero height, so the lane is aligned while rows
  still flow unmeasured.
- **The row window is measured before the lane.** `TableGrid` calls `useRowWindow` before
  `useHeaderLane`: React runs a component's layout effects in the order they are declared, and
  `ResizeObserver` callbacks are delivered in the order the observers were created, so on every commit
  and every resize the box is read before the spacer is written — as when one function did both. The
  release of the width hold calls the two in the same order. The order is kept because #25's triage
  asked for it, on the reason that a spacer write can add a horizontal scrollbar and so change the
  box's `clientHeight`. Read from the code, showing the spacer cannot: it is shown only when the
  content already overflows, so the scrollbar is already there. Hiding it at a release can remove one,
  and then either order reads the box before the scrollbar goes, as before the split. **No check sees
  the order**: calling the lane first, and measuring it first at the release, left jsdom and
  `check:example` green (2026-09-30).
- **The lane reads everything before it writes anything.** The gutter, the height, the probe and the
  content widths are read first, then the padding and the spacer are written, so the lane adds no
  layout forced by a read after its own write. That moved the padding write: when one function did
  both, it came before every other read — the box, the probe, `scrollHeight`, the children's
  `scrollWidth` — and it now comes after all of them. The padding moves only the lane, so each of
  those reads sees the same lengths — unless a padding change altered the header's height, and then
  the scroller resizes and both observers measure again.
  Measured 2026-09-30 on the example in headless Chrome, scrolling the grid over 60 steps, five runs
  each before and after the split: one forced layout per commit that changed the DOM in both, none
  inside the lane's `measure`, and no time difference outside the runs' spread (a median of 780 µs a
  DOM-changing commit before, 730 after; the lane's half about 20 µs a call). The width hold's
  release was not traced.
- **Its observer is attached once and reads only refs**, as the row window's does
  ([row windowing](row-windowing.md)), so the first closure never goes stale. The width hold, built
  once, calls the first closures of both — the lane's `measure` and the row window's, handed in as
  `remeasure` — which is why `remeasure` must read only refs too.
- **The scroller reserves its gutter** (`scrollbar-gutter: stable`): a classic scrollbar appearing
  would otherwise narrow the rows under a header that did not narrow.
- **Chromium withholds an empty reserved gutter from the horizontal scroll range.** When the gutter
  holds no scrollbar — the rows do not overflow vertically, or scrollbars are hidden — the scroll stops
  one gutter-width short of `scrollWidth − clientWidth`, so the last gutter-width of every row and of
  the header can never be scrolled into view. A plain block with no justable code does the same, so it
  is the engine's, not the absolutely placed rows'. Firefox does not withhold it (#22's triage).
- **So a spacer extends the content by the gutter while that happens.** An invisible, `aria-hidden`
  block in the scroller's flow, after the canvas (so never the row sample; outside the canvas, so it
  covers leading rows and `showRows={false}`), as wide as the content plus the gutter. It is 1 px tall
  with a −1 px top margin: a zero-height absolutely placed box did not extend the scroll range in
  Chrome 154, and the margin takes the 1 px back, so `scrollHeight` is unchanged (measured: 619 and
  604 on a short list, as without it). **It is in flow rather than absolutely placed so the scroller
  stays unpositioned**, which #9's call on the marquee's rectangle relied on
  ([marquee](marquee.md)): an absolutely placed spacer needed `position: relative` on the scroller.
  Written by hand, like the lane's padding.
- **Whether to pad is the engine's answer, measured once per document.** `emptyGutterWithheld`
  scrolls an offscreen, invisible probe scroller reserving its gutter to its end, once with content
  shorter than it and once taller, and caches whether each stopped short — by more than half a px,
  since the shortfall is either 0 or a whole gutter and a fractional zoom rounds the gutter. `measure` pads only when
  the real scroller's gutter is non-zero, the probe says the case it is in (short or tall) is
  withheld, and the content overflows horizontally. Hidden scrollbars withhold in the tall case too,
  so "no vertical overflow" alone would miss them. How much is the real scroller's
  `offsetWidth − clientWidth`, since a consumer's scrollbar styling reaches the grid but not the probe.
- **The content is measured without the spacer, never by hiding it.** Hiding the spacer to read
  `scrollWidth` shrank the range for that moment, and Chrome clamped `scrollLeft` back by the gutter
  on every commit — a drag at the end shrank its column by 35 instead of 20. The content is the
  widest `scrollWidth` of the scroller's other children, all of which start at its left edge.
- **The border drag's width hold subtracts the pad** (`holdWidth`: `scrollWidth − spacerPadRef`). It
  runs on every move of a drag; holding `scrollWidth` as it is, the spacer would be re-measured one
  gutter wider each time — 898 → 958 px over four moves. **Releasing it re-measures**: the hold is
  lifted in the DOM with no commit of the grid, and until one the spacer kept the drag's width —
  60 px of blank space past the last cell after a 60 px drag.

## Code

- `src/hooks/useHeaderLane.ts` — `useHeaderLane`, `measure`, `HeaderLane`, `HeaderLaneInput`, `laneRef`, `laneInnerRef`, `emptyGutterWithheld`, `GutterWithheld`, `spacerRef`, `spacerPadRef`, `gridScroller`, `holdWidth`, `remeasure`
- `src/components/TableGrid.tsx` — `TableGrid`, the `onScroll` both hooks share

## Reference behaviour

Measured on the example at a 700 px viewport, scrolled to the horizontal end, 2026-09-30, before and
after #22 — max `scrollLeft`, and how far the last cell ends past the scrollport:

| Engine | Short list | Tall list |
|---|---|---|
| Chrome 154, scrollbars hidden | 140, 15 px cut → **155, 0** | 140, 15 px cut → **155, 0** |
| Chrome 154, scrollbars drawn | 140, 15 px cut → **155, 0** | 155, 0 → 155, 0 |
| Firefox 147, overlay scrollbars (the default here; gutter 0) | 140, 0 → 140, 0 | 140, 0 → 140, 0 |
| Firefox 147, classic scrollbars (17 px gutter) | 157, 0 → 157, 0 | 157, 0 → 157, 0 |

The header's last column ended where the row's did in every case. Safari is not measured.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — a zero gutter (overlay
  scrollbars) or a probe that measured nothing pads nothing.
- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — the
  lane's padding and translation are what make the header's tracks and the rows' tracks sit over one
  another; equal track lists are not enough if the boxes they lay out in differ.

## Blast radius

- [Row windowing](row-windowing.md) — shares the scroller, the scroll event, the width hold's
  release (which re-measures the row window first, through `remeasure`) and the read order above: a
  change to which hook is called first, or to either's timing, moves when the box is read against when
  the spacer is written.
- [Header row](header-row.md) — the content of the lane; its `z-20` and surface colour sit over rows
  scrolled beneath.
- [Grid scaffold](grid-scaffold.md) — the lane is the grid's first `rowgroup`; the spacer is an
  `aria-hidden` child of the scroller, after the canvas.
- [Column resize](column-resize.md) — the width hold subtracts the spacer.
- [Marquee](marquee.md) — the rectangle's bound is the scroller's `scrollWidth`, which the spacer
  extends by the gutter.

## Known holes / open

- **Safari is unmeasured**, and nothing here runs it.
- **Right to left is not handled**: the gutter is on the left there, and the spacer extends the right.
- **The engine probe runs once per document.** A scrollbar mode switched at runtime (overlay to
  classic, as a platform setting or a plugged-in mouse can) keeps the first answer until a reload.
- **The gutter is re-measured only when `useHeaderLane`'s `measure` runs** — each commit and each scroller resize.
  A scrollbar that appears without either (a platform setting changed at runtime) is not seen until
  the next. Since #32 a scroll inside a block is not a commit ([row windowing](row-windowing.md)).
