# Drawn columns are tracks are cells

## The fact

For one table, three lists are the same ordered list — the model's `visibleColumns(layout)`:

1. the px tracks of `gridTemplate(layout)`, which then adds exactly one filler track that is not a
   column;
2. the header's `columnheader`s (`TableHeader`'s `columns`);
3. every row's `gridcell`s (`TableRow`'s `columns`), and each of the ruler's groups when auto-fit
   runs — one per column the consumer asks to measure, drawn as that column's cells.

And the header and every row lay those tracks out in boxes of the same width, so the tracks sit
over one another. `aria-colcount` is the count of the list.

Checkable: in a rendered table, every `[role=row]` has as many children as the template has px
tracks, and every row's computed track widths equal the header's.

## Why it is cross-cutting

The three lists are drawn by three components that never call the model or each other. The
consumer threads `visibleColumns` and `gridTemplate` into each one separately, as props; nothing in
the engine compares them, and the grid's `colCount` is a fourth separately-passed copy. The box
widths are held at a fourth and fifth site — the placed row's `right: 0` and the header lane's
padding and translation — none of which knows about columns at all. No territory-to-territory edge
carries this, because there is no call to hang it on.

## Territories it holds in

- [Column model](../territory/column-model.md) — `visibleColumns` is the list; `gridTemplate` is the
  track side and adds the filler.
- [Header row](../territory/header-row.md) — one `columnheader` per `columns` entry, on `gridStyle`.
- [Table row](../territory/table-row.md) — one `gridcell` per `columns` entry; `style` merged under
  `gridStyle` so the template is never replaced.
- [Grid scaffold](../territory/grid-scaffold.md) — `aria-colcount` from `colCount`.
- [Row windowing](../territory/row-windowing.md) — a placed row carries `left: 0` and `right: 0`.
- [Header lane](../territory/header-lane.md) — the lane's padding matches the scroller's gutter and
  its inner box follows `scrollLeft`.
- [Stylesheet and prefix](../territory/stylesheet-and-prefix.md) — `TABLE_GRID`'s `min-w-min` keeps a
  row as wide as its tracks.

## What a violation looks like

Nothing throws. **The track list comes from the inline style, not from the number of children**, and
the row height is fixed, so:

- **an extra cell** (one for a hidden column) overflows into an implicit grid row that the row
  height clips — its content disappears;
- **a missing template** (a wrapper's `style` replacing it) collapses the row to one track, and its
  cells stack into implicit rows that draw over the next row;
- **a narrower box** (a placed row with `left` only, a header without the gutter) keeps the right
  track *count* but the filler absorbs a different width, so the header's first track and the row's
  first track differ.

It only shows in a real browser — jsdom lays nothing out, so every suite here passes through all
three.

## Discovery history

All in PenTerm, before the engine moved here:

- `penterm 1b30468c3` (2026-08-25) — padding cells in a row were found to do nothing: measured,
  removing them or adding one moved nothing, because tracks come from the inline style and an
  overflowing child lands in a clipped implicit row.
- `penterm 3c0f4401a` (2026-08-26) — a context-menu wrapper's `style` replaced the row's template:
  header tracks `558 80 112 128`, the wrapped row one track of 914 px and four implicit rows.
- `penterm 5bf00320d` (2026-08-26) — windowing placed rows with `left: 0` only: header tracks
  `510 120 112 128`, row tracks `96 120 112 128`.
- `penterm 99dcdf7e1`, `5d0c30bcd` (2026-09-01) — the filler track made the last column's right edge
  a real border, so the last column got a resize handle too.

Four separate slices, each finding one face of the same fact.

## Where it will recur

- **Any new component that draws per-column content** — a footer, a filter row, a group header —
  must take the same `columns` and the same `gridStyle`, and must be told nothing else.
- **Any wrapper around a row or the header** that injects props: does the wrapped component declare
  `style`?
- **Any change to how a row or the lane is positioned or padded**: is its box still the width the
  header's box is?
