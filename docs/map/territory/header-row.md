# Header row

## What it is

`TableHeader`: the one `row` at `aria-rowindex` 1, drawing a `columnheader` per drawn column. Each
cell is a sort button, whole, with the label and — on the sorted column — an arrow, and carries the
resize handle on its right border. It paints the header's surface, ink, border, hover fill and focus
ring, all through `--table-*` variables.

## Governing decisions

**None.**

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **The header draws the columns it is given, laid out by the template it is given.** Tracks come
  from `gridStyle`, not from `HeaderColumn.width`; that width is read only as a drag's starting
  width.
- **Only the sorted column carries `aria-sort`.** The sort button's accessible name is the label
  alone; the state is on the `columnheader`.
- **The whole cell is the sort target.** `self-stretch`, because the grid centres items and a
  content-height cell left the target short — 20.5 px against 16.5 px (PenTerm). Label left, arrow
  after it, `px-2` keeping the text off the handle.
- **Rank comes from weight and the arrow's presence, never from dimmed ink.** The ink is its own
  variable, `--table-header-ink`, because the header paints its surface and a surface without a
  paired ink reads as whatever the page's ink is.
- **The hover fill is a layer, not a background** (`HOVER_LAYER`): an `::after` behind the content
  (`isolate` on the button, inset 0, radius inherited) painting `--table-hover`, faded in over 120 ms.
  Tailwind 4 wraps `hover:` in `@media (hover: hover)`, so a tap on a touch device leaves nothing
  stuck; `enabled:` keeps it off a disabled button. It reproduces PenTerm's `.hover-ink` class in
  prefixed utilities, which is why the lint refuses a literal `hover-ink`.
- **The header row is `relative z-20` over its own surface.** `relative` makes the stacking context
  that keeps its `z-10` handles with it; the surface keeps rows scrolled under the lane from showing
  through.
- **Two data attributes are how a consumer finds the header**: `data-table-header` on the row and
  `data-table-resize="<key>"` on each handle. PenTerm's guide tour and its checks select by them, and
  `README.md` names them, with `data-table` and `data-table-ruler`, as stable.
- **Height and type are the consumer's**, as `className` on the row; labels arrive translated.
- **The sort button undoes a browser's button styles itself** — margin, border, background, vertical
  padding, and the font family, size and line height, which it inherits. The package ships no
  preflight, so nothing else will: in a page without one, Chrome drew each header cell as a grey
  2 px outset button in 13.33 px Arial (measured in `example/`, 2026-09-28). PenTerm never showed it,
  because its own Tailwind preflight resets buttons. The font is inherited in three utilities rather
  than the `font` shorthand, which would also set the weight `font-medium` sets — two utilities for
  one property on one element are what [stylesheet and prefix](stylesheet-and-prefix.md) forbids. A
  test pins the classes; only a browser shows the effect.
- **The arrow icons are `lucide-react`'s** `ArrowUp` and `ArrowDown` — the reason it is a peer
  dependency.

## Code

- `src/components/TableHeader.tsx` — `TableHeader`, `TableHeaderProps`, `HOVER_LAYER`
- `src/types.ts` — `HeaderColumn`, `TableSort`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Row one is the header](../invariant/row-one-is-the-header.md) — this row hard-codes
  `aria-rowindex={1}`.
- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) — one
  `columnheader` per entry of `columns`, laid out by `gridStyle`.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  labels, the handles' accessible name, what a sort press does and which presses may resize.

## Blast radius

- [Column resize](column-resize.md) — the handle lives in this component and its press handler is
  here.
- [Auto-fit](auto-fit.md) — the handle's double-click is the entry point to `measure`; fitting every
  column (`measureAll`) is triggered by the consumer, not from here.
- [Column model](column-model.md) — the sort shown here is the one `nextSort` produced.
- [Colour variables](colour-variables.md) — every colour this component paints.
- [Header lane](header-lane.md) — the strip this row sits in.
- [Stylesheet and prefix](stylesheet-and-prefix.md) — its hover and focus utilities are the most
  variant-heavy classes in the package.

## Known holes / open

- **Renaming a data attribute breaks nothing here.** `README.md` names them as stable, and a
  consumer's checks select by them, but no test in this repository holds their names.
