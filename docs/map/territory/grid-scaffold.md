# Grid scaffold

## What it is

The `role="grid"` structure `TableGrid` draws: one focusable container with the header lane over a
scroller, the ARIA that names rows and the focused row, the leading rows that sit above the data,
and the grid-wide switches — `fill`, `disabled`, `showRows` — plus the consumer's hooks into the
scroller (`onFloorClick`, `wrapScroller`, `scrollerProps`). It is the shape every other component is
drawn inside.

## Governing decisions

**None.**

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **Divs with explicit ARIA, not `<table>`.** Overriding a table's `display` breaks its
  accessibility tree, and `<tbody>` admits only `<tr>`, so neither a shared grid track list nor
  windowing survives a `<table>`. `grid` rather than `list`, because `aria-sort` is valid only on a
  `columnheader`. The keyboard bill of that choice is in [keyboard movement](keyboard-movement.md).
- **One focusable container; rows carry no `tabIndex`.** A roving tabindex cannot survive windowing —
  a row outside the window has no element. `aria-activedescendant` names the focused row and is
  **removed while that row is not drawn**: an id no element has is worse than none.
- **The id is handed out, not applied.** `RowPlace.id` is `${rowIdPrefix}-row-${index}`; the grid
  passes it to `renderRow` and never sets it itself. The consumer's row must carry it, or
  `aria-activedescendant` points at nothing. `rowIdPrefix` must be unique per grid.
- **`aria-rowcount` is computed, never left to the browser**, because browsers count the DOM, which
  under windowing holds only the window. See [row one is the header](../invariant/row-one-is-the-header.md).
- **Only the grid's rows are its children.** The header lane and the scroller are `rowgroup`s; the
  canvas inside the scroller is `presentation`, because a rowgroup inside a rowgroup is not a shape
  ARIA has. State messages ("empty", "loading") are the consumer's siblings of the grid, and
  `showRows={false}` draws no data rows while leaving the leading rows.
- **Leading rows are never windowed** and each is told its `aria-rowindex` (from 2).
- **`aria-multiselectable` is always set.** The grid declares it whatever the consumer's selection
  model is.
- **A disabled grid is dead to every gesture by one class**, `pointer-events-none` with
  `opacity-50`, plus `aria-disabled` — rather than a condition in each handler, which a handler added
  later would forget. The container keeps its `tabIndex`, so it can still take focus and keys.
- **`fill` chooses between taking the remaining height (`flex-1`) and shrinking to the header
  (`shrink-0`).**
- **A floor click is a press on the scroller itself** (`target === currentTarget`), never one that
  bubbled from a row.
- **`scrollerProps` is spread after `role` and `ref` and before the scroll and click handlers and
  `className`**, so it can add attributes but cannot replace those three.
- **`wrapScroller` wraps the scroller element**, e.g. in a context-menu trigger; a wrapper that
  injects props must pass them through, as [table row](table-row.md) records for rows.

## Code

- `src/components/TableGrid.tsx` — `TableGrid`, `TableGridProps`, `RowPlace`, `rowIdPrefix`, `firstDataRow`, `leadingRows`, `onFloorClick`, `wrapScroller`, `scrollerProps`

## Reference behaviour

**None.** in this repository. PenTerm's `explorer-block.md` § Reference behavior records the W3C
APG grid pattern and VS Code's list (one focusable container) as what this shape was checked against.

## Cross-cutting invariants

- [Row one is the header](../invariant/row-one-is-the-header.md) — `firstDataRow`,
  `aria-rowcount` and the leading rows' indices are computed here.
- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) —
  `aria-colcount` is the consumer's `colCount`, which nothing checks against the drawn columns.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the label, what a floor click does, and what wraps the scroller are the consumer's.

## Blast radius

- [Row windowing](row-windowing.md) — which rows exist to be named by `aria-activedescendant`.
- [Header lane](header-lane.md) — the first child of the grid, and a `rowgroup` it declares.
- [Keyboard movement](keyboard-movement.md) — `focus` is the keyboard's row; the grid shows it and
  writes the page size back.
- [Table row](table-row.md) — receives `RowPlace` and must carry its `id` and `rowIndex`.
- [Colour variables](colour-variables.md) — the grid root carries `data-table`, where the consumer
  binds the colours.
- [Stylesheet and prefix](stylesheet-and-prefix.md) — every layout class here is a prefixed utility.

## Known holes / open

- **`aria-multiselectable` is unconditional.** A consumer with single selection announces multiple;
  there is no prop to say otherwise.
- **A disabled grid still takes focus and keys.** `pointer-events-none` stops pointers only; whether
  keys should also stop is decided nowhere.
- **`colCount` is not derived.** A consumer that passes a count different from its drawn columns
  gets a wrong `aria-colcount` and no error.
