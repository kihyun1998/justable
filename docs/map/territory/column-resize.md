# Column resize

## What it is

Dragging a column border to set that column's width: the handle each `columnheader` draws on its
right edge, the press handler that arms a drag, and `useColumnResize`, which follows the pointer on
`document` and reports the width until the button comes up.

## Governing decisions

- **#10, the maintainer's calls in triage, 2026-09-30**: this drag takes #9's two release rules, and
  runs on the [drag lifetime](drag-lifetime.md) the marquee shares; what an interrupted drag tells its
  consumer stays this drag's. What they were shown, and what they did not cover, is in that note.

Nothing else is decided in this repository. Adjacent, in PenTerm: ADR-0099 (a resize boundary is not
keyboard-operable) and ADR-0100 (a resize in flight is not cancelled) roster this column border among
PenTerm's resize boundaries. They decide PenTerm's policy across its boundaries; nothing here adopts
them, and the code matches both only because it implements neither a key nor Escape.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **A border belongs to the column on its left.** Its handle straddles that column's right edge — a
  12 px target (`w-3`, `-right-1.5`) around a 1 px line. The last column has one too: the filler track
  makes its right edge a real border.
- **The line stops 0.375 rem short of both edges**, so it forms no T with the header's bottom border.
- **The line shows by colour, never width**, so nothing shifts under the pointer; it stays at its
  active colour for the whole drag, because the pointer leaves the handle as soon as it moves.
- **Mouse events on `document`, not HTML5 drag** — PenTerm's host (Tauri) swallows HTML5 drags in its
  webview. `mousedown` arms, `mousemove` reports, the pressing button's `mouseup` ends.
- **The press is suppressed for every button, then the consumer decides.** `preventDefault` and
  `stopPropagation` run first, so a wheel press never starts autoscroll; only then does
  `refusePress(event)` say whether this press arms a drag. **The engine holds no rule for which button
  arms, and no default**, so `refusePress` is required.
- **The reported width is unclamped**, `startWidth + (clientX − startX) / scale + Δscroll`, where
  `scale` is screen px per table px for a scaled copy of the table and `Δscroll` is how far the grid's
  scroller has scrolled horizontally since the press. The consumer's model clamps.
- **Only the pointer is divided by the scale.** `scrollLeft` is in the scroller's own px, which are
  table px, whatever transform scales the table on screen. Measured in Chrome, 2026-09-28: inside
  `transform: scale(0.5)`, `scrollLeft = 100` moved the content 50 screen px.
- **The scroll is read from the element, not only from its `scroll` event.** A browser sends `scroll`
  a frame after the scroll, so a width taken only from the event misses the last step before the
  button comes up. Measured in the example: exactly one 16 px step short, three runs of three. So a
  pointer move reads `scrollLeft`, and the release reads it once more before detaching; the event
  covers a pointer held still.
- **The engine never scrolls for a drag** — the maintainer's call, 2026-09-28 (#8), over an engine
  loop and over an engine loop the consumer could replace. Shown: PenTerm already shares one
  edge-scroll loop across its tab strip, library tree and explorer list (`createEdgeAutoScroll`: 48 px
  zone, 2→24 px a frame), so an engine loop would give it a second speed. `onResizeDrag` hands the
  consumer each move and the scroller, then `null` at the end — at the release and when the header
  unmounts mid-drag, so the consumer's loop always stops. It did not cover vertical scrolling during a
  drag, nor what the loop's zone and speed should be for any consumer. #9 (2026-09-29) extended it to
  the vertical axis for the [marquee](marquee.md).
- **During a drag the grid's content keeps its widest width**, and lets go at the release — the
  maintainer's call, 2026-09-29, over leaving the border where it is while the content slides. Without
  the hold, a column shrunk while the grid is scrolled to its right end made the content narrower, the
  browser pulled `scrollLeft` back to fit, `Δscroll` counted that pull, and the column shrank again:
  measured, a 20 px drag shrank it 245 px. Scrolled to the end, no width keeps the border under the
  pointer, since the content's right edge is pinned to the view. The alternative needed the scroll's
  end, and Chrome's is not `scrollWidth − clientWidth` under `scrollbar-gutter: stable` with a
  vertical scrollbar: measured 140 against 155, the scrollbar's 15 px. So the drag leaves blank space
  on the right, and the content slides once, at the release. The hold is a `min-width` on the rows'
  canvas, raised on every read of the drag (`holdWidth`, in `TableGrid`'s `gridScroller`). It is
  written by hand on an element whose JSX sets `style` too — the canvas's `height` — which
  [header lane](header-lane.md)'s rule for hand-written styles avoids: two owners of one inline
  style. It holds only because React never writes `min-width` there; a `minWidth` in the canvas's
  JSX would be reset by every render mid-drag.
- **The header reaches the grid through a context `TableGrid` provides** (`GridScrollerContext`: the
  scroller and the width hold), since the header is handed to the grid as an element. A header drawn
  outside a grid gets neither: `Δscroll` stays 0, nothing is held, and `onResizeDrag` carries
  `scroller: null`.
- **The example's loop** (`example/edgeScroll.ts`, `useEdgeScroll('x')` here; the marquee's is
  `'xy'`) is time-based, eased, and reaches its top speed at
  the edge rather than past it, measuring the edge inside the vertical scrollbar. Its first version
  was faster to the left: the grid's right edge was the window's, so the pointer could go far past the
  left edge and not the right, and the right edge counted the scrollbar as view. Measured after the
  change, holding a border at each visible edge: 779 px/s right, 803 px/s left, for a 1000 px/s
  target.
- **A drag cannot outlive its component or another drag**, and **only the button that pressed ends
  it** — a mouseup of another button is ignored, and a move whose `buttons` no longer hold it ends the
  drag as its release would have. Both are the [drag lifetime](drag-lifetime.md)'s. This drag tells
  its consumer `null` however it ends — released, replaced by a second press, or its header unmounted —
  so the consumer's loop always stops; a header gone mid-drag writes no width.
- **`startResize` passes the press's `button` to `begin`**; a consumer calling `useColumnResize`'s
  `begin` without it keeps the release it had before #10, any button's `mouseup`.

## Code

- `src/hooks/useColumnResize.ts` — `useColumnResize`, `ResizeDrag`
- `src/components/TableGrid.tsx` — `gridScroller`, `holdWidth`
- `src/components/TableHeader.tsx` — `TableHeader`, `startResize`, `refusePress`, `onResizeDrag`
- `src/components/gridScroller.ts` — `GridScrollerContext`
- `example/edgeScroll.ts` — `useEdgeScroll`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  `refusePress` is this territory's policy seam, and the clamp is the model's; `onResizeDrag` is the
  seam for edge scrolling.
- [Lengths are layout px](../invariant/lengths-are-layout-px.md) — only the pointer is divided by the
  consumer's `scale`; `scrollLeft` is layout px already.

## Blast radius

- [Header row](header-row.md) — draws the handle and its line; the line's colour follows
  `resizing`.
- [Column model](column-model.md) — `withWidth` clamps what this reports.
- [Auto-fit](auto-fit.md) — the same handle's double-click; a change to the handle's hit area moves
  both gestures.
- [Grid scaffold](grid-scaffold.md) — owns the scroller and provides it to the header; a change to
  which element scrolls horizontally moves `Δscroll`.
- [Verification gates](verification-gates.md) — `check:example` holds a border past the edge.
- [Marquee](marquee.md) — shares the example's edge-scroll loop; a change to its horizontal axis
  moves both drags.
- [Drag lifetime](drag-lifetime.md) — owns when this drag ends; a change there moves when
  `onResizeDrag` gets `null`.

## Known holes / open

- **Mouse only.** No touch or pen drag: the handlers are `mousedown`/`mousemove`/`mouseup`, and
  touch input produces no compatible `mousemove` stream. Whether that is policy or omission is
  recorded nowhere here (PenTerm is a desktop app).
- **Not keyboard-operable, and Escape does nothing mid-drag.** Decided for PenTerm by its ADR-0099
  and ADR-0100; undecided for any other consumer.
