# Changelog

Written by hand at each release. Versions follow semver from 0.x: until 1.0, a breaking change to
what `src/index.ts` exports — or to how an export behaves — bumps the minor (0.1 → 0.2), and
anything else the patch.

## 0.1.2 — 2026-09-29

### Added

- **A marquee**: `TableGrid`'s `marquee` draws a rectangle dragged over the rows, as a file explorer
  does, and reports the rows it touches as `{ anchor, head }` through `onMarquee` — on `start`,
  `move`, `end` and `cancel`, with the drag's mouse event and the grid's scroller. What a range
  selects stays yours; `refusePress` and `threshold` are required, and the table never scrolls for
  the drag. Types `MarqueeOptions`, `MarqueeReport`, `MarqueePhase`, `MarqueeRange`. Two colour
  variables, `--table-marquee-fill` and `--table-marquee-border`, and `data-table-marquee` on the
  rectangle (#9).

### Documentation

- The README opens with the logo; brand assets are under `logo/` in the repository.

## 0.1.1 — 2026-09-29

### Documentation

- The README is written for someone meeting the package for the first time: a quick start that is a
  tested file in the repository, how the pieces fit together, columns, keyboard, colours,
  accessibility, and lists that are not a table. The links to example files point at GitHub, since
  the package does not ship them.

## 0.1.0 — 2026-09-29

The first release, published as `@kihyun1998/justable` — npm refused the unscoped `justable` as too close to
`stable`. Before it, the package reached its one consumer, PenTerm, only as
`file:../justable`; the changes below are measured against that.

### Breaking

- **`TableGrid` no longer says `aria-multiselectable` unless asked.** Pass `multiselectable` where
  several rows can be selected at once; it is off by default (#4).
- **Removed from the exports**: `nextFocusIndex`, `classNames`, `typeAheadStep`, `typeAheadIndex`,
  `TYPE_AHEAD_MS`, and the types `TypeAheadStep` and `FocusMoveInput`. Type-ahead for a list that is
  not the grid is `useTypeAhead` (#5).

### Added

- **`useTypeAhead`**, with `TypeAheadAnswer`: the grid's type-ahead for any list whose movement is its
  own (#5).
- **`TableHeader`'s `onResizeDrag`**, with `ResizeDrag`: each move of a running border drag, with the
  grid's scroller, then `null` at its end — the seam for the consumer's own edge scrolling (#8).

### Fixed

- A space typed inside a type-ahead query extends it instead of being dropped (#1); type-ahead walks
  across letter case.
- A border drag keeps the border under the pointer while the grid scrolls horizontally (#8), and a
  column shrunk with the grid scrolled to its end no longer collapses to its minimum.
- The header's sort buttons no longer show a browser's button styles on a page without a CSS reset.
