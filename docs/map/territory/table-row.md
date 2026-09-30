# Table row

## What it is

`TableRow`: one `row` laid out on the grid template, with one `gridcell` per drawn column. The
consumer supplies what goes in each cell, the cell's classes and title, and every attribute and
handler on the row itself — selection, focus and hover colours included.

## Governing decisions

- **#16, the maintainer's call in triage, 2026-09-30.** Shown: in the example (Chrome 154, 28 px
  rows), a cell 19.6 px tall whose bands 1.5 px inside the row's edges landed on the row, and four
  cell styles side by side — as shipped, `align-self: stretch` alone (text 4 px high), stretch with
  `align-content: center` (as shipped, pixel for pixel), stretch with a flex cell (a right-aligned
  size 39.9 px from the edge instead of 8). Decided: **the cell stretches to its row and stays a block
  box, centred by `align-content`**, and an engine without `align-content` on a block box keeps the
  full-height target but shows the text about 4 px high — the fallback accepted. Reversible only by
  the maintainer. It did not cover row height, padding, density, or the marquee's hit test.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **One cell per entry of `columns`, and no other.** A cell for a hidden column overflows into an
  implicit grid row that the row height clips — its content vanishes with nothing thrown. See
  [drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md).
- **An outside style merges under the grid template** (`{ ...style, ...gridStyle }`). A Radix
  `asChild` trigger folds its `style` into the child only for props the child declares; undeclared,
  it arrived in the rest props and replaced the template whole — the header drew four tracks and a
  row one (`penterm 3c0f4401a`). `TableRow` declares `style`, and a consumer component wrapping it
  must declare `style` too. The windowing placement arrives the same way.
- **The row's position is the consumer's to pass.** `rowIndex` becomes `aria-rowindex`; the grid's
  `RowPlace` supplies it and the `id` that `aria-activedescendant` points at, and the consumer must
  put both on the row.
- **Cells pad themselves** (`TABLE_CELL`); the row adds no gap — see
  [stylesheet and prefix](stylesheet-and-prefix.md).
- **A cell is as tall as its row, so every point of the row inside a cell's track is that cell.** The
  row's grid centres its items (`items-center`); `TABLE_CELL` overrides that for the cell
  (`self-stretch`), as the [header row](header-row.md) does for its cell. A consumer that asks which
  cell a press is on by its target — `closest('[role="gridcell"]')` — needs no geometry of its own.
  Before #16 the bands above and below a content-height cell belonged to the row alone: 4.2 px each
  in the example, 4.7 px in PenTerm, whose `rowPress.ts` tests the press's x against the cells'
  spans to cover them.
- **The content is centred inside the cell by `align-content: center`, and the cell stays a block
  box.** A flex or grid cell would make its text an anonymous item: `text-overflow` applies to block
  containers only, so a consumer's `truncate` on the cell itself — PenTerm's type and numeric cells —
  would stop ellipsing, and a flex item shrinks to its text, so `text-align: right` has nothing to
  push against (measured: 39.9 px from the edge instead of the 8 px padding). With `align-content`
  the text lands where the row's centring put it before, to the pixel, in the example.
- **Content taller than its row draws as it did.** CSS Box Alignment makes a block box's
  `align-content: center` safe, so content taller than its box would start at the top — but the
  row's grid track grows to the tallest cell, so a cell is never shorter than its content. Measured
  2026-09-30, Chrome 154, the example's row set to 12 px: the cell was 19.6 px from the row's top,
  text at 0–18 px, with the row's old centring and with the new classes alike, for a plain cell and
  for one with `overflow: hidden` and an ellipsis on itself.
- **`align-content` on a block box is new**: Chrome and Edge 123, Firefox 125, Safari 17.4 (MDN's
  browser-compat-data, `css.properties.align-content.block_context`, read 2026-09-30). An older
  engine ignores it: the cell still fills the row, and the text sits at the top of it, about 4 px
  higher than centred. That is the fallback #16 accepted.
- **A consumer's cell class must not set `align-self` or `align-content`**: the class join resolves no
  conflict ([stylesheet and prefix](stylesheet-and-prefix.md)). `align-items` on a flex cell is not
  one of them — PenTerm's name cell centres its own items inside the stretched cell.
- **The ruler's cells take the same classes and none of the height.** They sit in a block, not a grid,
  so `self-stretch` does nothing there. `align-content` other than `normal` makes each ruler cell its
  own formatting context, which moves no width: the auto-fit and fit-all checks read the same widths.

- **Row colours are the consumer's classes.** The engine paints none on a row.

## Code

- `src/components/TableRow.tsx` — `TableRow`, `TableRowProps`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — this is
  the cell side.
- [Row one is the header](../invariant/row-one-is-the-header.md) — `rowIndex` is passed through, never
  computed here.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  row colours and every row handler.

## Blast radius

- [Row windowing](row-windowing.md) — its absolute placement reaches the row only through `style`.
- [Grid scaffold](grid-scaffold.md) — `RowPlace` is what the row must carry.
- [Auto-fit](auto-fit.md) — the ruler must draw what this row's cells draw.
- [Column model](column-model.md) — `columns` and `gridStyle` come from it.
- [Stylesheet and prefix](stylesheet-and-prefix.md) — `TABLE_GRID` and `TABLE_CELL`.

## Known holes / open

- **Nothing checks that `columns` matches the template.** A mismatch is silent — see the invariant.
- **The centring is checked in Chrome only** (`check:example`). The fallback in an engine without
  `align-content` on a block box has not been seen.
