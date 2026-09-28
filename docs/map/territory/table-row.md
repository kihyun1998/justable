# Table row

## What it is

`TableRow`: one `row` laid out on the grid template, with one `gridcell` per drawn column. The
consumer supplies what goes in each cell, the cell's classes and title, and every attribute and
handler on the row itself — selection, focus and hover colours included.

## Governing decisions

**None.**

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
