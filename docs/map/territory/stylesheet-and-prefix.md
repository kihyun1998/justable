# Stylesheet and prefix

## What it is

The package's own CSS and the class discipline that makes it safe to ship: every class the engine
renders is a Tailwind utility prefixed `justable:`, `src/style.css` builds exactly those utilities
into `dist/style.css`, and the consumer imports that sheet once. Also the two shared class constants
and the class join the components use.

## Governing decisions

**None.** The choice to ship a prefixed sheet rather than have each consumer's Tailwind scan the
package is recorded in PenTerm's note as the maintainer's call; no record here holds it.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **A consumer needs no Tailwind.** The sheet holds theme variables and utilities only — no
  preflight — so it resets nothing on the consumer's page.
- **The prefix is the collision guard, and it is total.** `prefix(justable)` prefixes the utilities
  and the theme variables Tailwind emits (`--justable-spacing`). An unprefixed class gets **no CSS at
  all**, so the element silently loses its layout; the prefix test holds every rendered class to it.
- **The layer order is declared first** (`@layer theme, base, components, utilities`). Cascade
  layers rank in the order first seen; imported ahead of a consumer's Tailwind, a sheet declaring only
  `theme` and `utilities` would put the consumer's `components` above every utility. Moving the engine
  onto this sheet changed nothing measured: all 65 elements of a table, `::after` included, computed
  the same styles before and after (PenTerm).
- **Which files contribute classes is Tailwind's automatic source detection**; `src/style.css` has no
  `@source` line.
- **`classNames` joins and resolves no conflict** (no `tailwind-merge`). Two utilities for one
  property on one element are left to stylesheet order, so engine classes are written so none
  coexist — the resize line carries its rest colour only at rest and its active colour only while
  dragged — and a consumer's classes must not target a property the engine sets on the same element.
- **Spacing belongs to the cells, never the grid.** `TABLE_GRID` has no gap or padding; `TABLE_CELL`
  pads each cell, and stretches it to its row ([table row](table-row.md)). A gap belonged to no
  cell, so header hover stopped short of it and a resize line drew beside the visible border
  (PenTerm). `min-w-min` keeps a row as wide as its tracks — without it a 470 px row in a 300 px box
  drew its selection fill 300 px wide (PenTerm).

## Code

- `src/style.css`
- `src/lib/tableClasses.ts` — `TABLE_GRID`, `TABLE_CELL`
- `src/lib/classNames.ts` — `classNames`
- `src/components/prefix.test.tsx` — `unprefixed`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Drawn columns are tracks are cells](../invariant/drawn-columns-are-tracks-are-cells.md) —
  `TABLE_GRID`'s `min-w-min` is one of the sites that keep a row's box as wide as its tracks.

The prefix itself is not an invariant note: it holds in every component, but it has no discovery
history of its own and one test enforces it, so it stays a rule of this territory until a second
site is found by breaking it.

## Blast radius

- [Header row](header-row.md), [grid scaffold](grid-scaffold.md), [table row](table-row.md),
  [auto-fit](auto-fit.md) — every class they render is held to the prefix.
- [Package and release](package-and-release.md) — the build step that produces `dist/style.css`, and
  the Tailwind pin.
- [Verification gates](verification-gates.md) — the prefix test sees only the branches its renders
  take.

## Known holes / open

- **Tailwind's `--tw-*` properties are not prefixed.** The built sheet registers
  `@property --tw-translate-x` and the like, as a consumer's own Tailwind does. The same Tailwind
  minor on both sides registers them identically, which is why the package pins `~4.2.1`; a consumer
  on another minor could see the last registration win.
