# Row one is the header

## The fact

Row positions are 1-based over the whole grid: the header is `aria-rowindex` 1, the leading rows
follow from 2, and data row `i` is `2 + leadingRows.length + i`. `aria-rowcount` is
`1 + leadingRows.length + total` — computed, never the number of rows in the DOM.

## Why it is cross-cutting

Three components write a row index and none computes it from another. `TableHeader` hard-codes 1;
`TableGrid` computes the leading and data offsets and hands data rows theirs through `RowPlace`;
`TableRow` writes whatever `rowIndex` the consumer passes it. The consumer carries the number from
the grid to the row. Windowing is what makes it matter: under it the DOM holds only the window, so a
browser's own count is wrong.

## Territories it holds in

- [Grid scaffold](../territory/grid-scaffold.md) — `firstDataRow`, `aria-rowcount`, the leading rows'
  indices.
- [Header row](../territory/header-row.md) — `aria-rowindex={1}`.
- [Table row](../territory/table-row.md) — `aria-rowindex` from `rowIndex`.
- [Row windowing](../territory/row-windowing.md) — the window is in data indices; the offset is added
  only when places are handed out.

## What a violation looks like

A screen reader announces the wrong position ("row 3 of 40" for the fourth data row) or the wrong
total. Nothing visible changes and no test in a layout-free environment can tell, except by reading
the attributes.

## Discovery history

**None recorded.** The numbering was designed at once in PenTerm (`penterm bceecab5c`, 2026-08-26)
and has not been broken since. This node exists because its sites share the assumption without
calling each other — see [the hub](../MAP.md#coverage) on why it is the weakest node.

## Where it will recur

- **A second header row, a footer, a group row, or anything drawn above the data** must enter the
  count and shift `firstDataRow`.
- **A consumer rendering rows without `RowPlace`** — its own rows outside `renderRow` — must compute
  the index the same way.
