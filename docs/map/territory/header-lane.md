# Header lane

## What it is

The non-scrolling strip the header sits in, above the scroller, and the two things that keep it
aligned with the rows below: it follows the rows' horizontal scroll, and it reserves the same right
gutter the scroller's vertical scrollbar takes. It is the reason the vertical scrollbar starts under
the header rather than beside it.

## Governing decisions

**None.**

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
- **The gutter is measured even without a box.** `measureBox` writes the lane's padding before its
  zero-height early return, so the lane is aligned while rows still flow unmeasured.
- **The scroller reserves its gutter** (`scrollbar-gutter: stable`): a classic scrollbar appearing
  would otherwise narrow the rows under a header that did not narrow.

## Code

- `src/components/TableGrid.tsx` — `TableGrid`, `measureBox`, `laneRef`, `laneInnerRef`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — the
  lane's padding and translation are what make the header's tracks and the rows' tracks sit over one
  another; equal track lists are not enough if the boxes they lay out in differ.

## Blast radius

- [Row windowing](row-windowing.md) — shares `measureBox`; a change to its early return or its
  timing moves the gutter write too.
- [Header row](header-row.md) — the content of the lane; its `z-20` and surface colour sit over rows
  scrolled beneath.
- [Grid scaffold](grid-scaffold.md) — the lane is the grid's first `rowgroup`.

## Known holes / open

- **The gutter is re-measured only when `measureBox` runs** — each commit and each scroller resize.
  A scrollbar that appears without either (a platform setting changed at runtime) is not seen until
  the next.
