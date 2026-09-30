# Changelog

Written by hand at each release. Versions follow semver from 0.x: until 1.0, a breaking change to
what `src/index.ts` exports — or to how an export behaves — bumps the minor (0.1 → 0.2), and
anything else the patch.

## Unreleased

### Breaking

- **A border drag ends only at the release of the button that started it**, or at the first move
  whose `buttons` no longer hold that button — as a marquee already did. Before, any button's
  `mouseup` ended it, and a drag whose release was missed kept following the pointer. A test that
  drags a border with synthetic events must now send `buttons` on its moves (`buttons: 1` for the
  primary button): a move without it ends the drag (#10).
- **A body cell is as tall as its row.** It was as tall as its content, centred by the row, so a
  press just above or below the content landed on the row and `closest('[role="gridcell"]')` found
  no cell. `TABLE_CELL` now stretches the cell (`align-self: stretch`) and centres its content inside
  it (`align-content: center`); the content draws where it did. What changes for you: a cell's own
  background or border spans the row's height; a cell class of yours must not set `align-self` or
  `align-content`; and `TABLE_CELL` is three classes, so a test looking for it as one class token
  must look for each of its classes. Engines older than Chrome 123, Firefox 125 and Safari 17.4 keep
  the full-height cell and show its text at the top (#16).

### Added

- **`useColumnResize()`'s `begin` takes the pressing `button`** as an optional last argument. Given,
  the drag takes the release rules above; left out, any button's `mouseup` ends it, as before (#10).

### Fixed

- **`aria-activedescendant` names no row while `showRows` is `false`.** It named the focused row's id
  though no data row was drawn, so it pointed at an element that did not exist.

## 0.2.0 — 2026-09-29

### Breaking

- **`useColumnAutoFit()`'s `measuring` is `K | readonly K[] | null`**, no longer `K | null`: it holds
  the list while `measureAll` measures. A consumer that only tests it against `null` and passes it
  to `TableRuler` as `column={measuring}` needs no change; one that uses it as a single key must
  narrow it first.

### Added

- **Fit every column at once**: `useColumnAutoFit()` returns `measureAll(keys)`, which mounts the
  ruler once for every distinct key asked about and answers `{ [key]: px | null }` — each the width
  a double-click on that column's border gives, unclamped, `null` where nothing was measured. Store
  each width with `withWidth`, as for `measure`. `TableRuler`'s `column` takes a key or an array of
  keys, one group each (#14).

### Fixed

- **A column key holding `"` or `]` no longer breaks auto-fit.** A ruler group was looked up with a
  CSS selector built from the key, which threw on such a key and left the ruler mounted with
  `measuring` stuck. Groups are now matched on their attribute, and `measure` and `measureAll` both
  unmount the ruler even when a read throws.

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
