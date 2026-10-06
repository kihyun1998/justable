# Changelog

Written by hand at each release. Versions follow semver from 0.x: until 1.0, a breaking change to
what `src/index.ts` exports — or to how an export behaves — bumps the minor (0.1 → 0.2), and
anything else the patch.

## 0.3.2 — 2026-10-06

### Added

- **`useTableKeyboard` returns `end`** beside `step` and `link`: its type-ahead's `end`, for a
  consumer that moves the row by other means — a click, a list replaced — so the next letter starts
  a fresh query. `end`, here and on `useTypeAhead`, is now one function for the hook's life (#55).

## 0.3.1 — 2026-10-06

### Added

- **`visibleRange` and `scrollToReveal` take an optional `canvasTop`**: where row 0 starts in the
  scroller's content, below any rows drawn above the list. Omitted, it is 0 and both answer as
  before (#46).

### Fixed

- **A scaled grid no longer throws *Maximum update depth exceeded*.** Under a CSS
  `transform: scale(…)` whose ratio is inexact — 0.37 and 0.83 among them, though not 1 or 0.5 — the
  measured row height alternated between two values a hair apart (28.0000257 and 27.9999889 at
  `scale(0.83)`), so every measurement looked like a new viewport and React gave up on the nested
  renders. The row's height is now read from its computed height, in layout px, instead of from its
  height on screen divided by the scale: no transform touches it and it does not move with the row's
  sub-pixel position. A side effect under a scale: rows are placed at the row's own height — 28 px
  apart under `scale(0.5)`, where they were 27.9913 apart before. The height taken is the row's border box,
  padding and borders included, as it was. A row whose computed height is not a positive length —
  `display: contents`, say — still falls back to `rowHeightRem` (#47).
- **A row revealed below `leadingRows` comes wholly into view.** Revealing the focused row ignored
  the leading rows' height, so a row reached at the bottom — by an arrow key or a type-ahead jump —
  stayed hidden below the view by that height (28 px under one 28 px `..` row). The window of drawn
  rows was shifted by the same height; past eight leading rows, rows at the top of the view went
  undrawn. Revealing row 0 still scrolls to the very top, showing the leading rows, when row 0
  then fits in the view; in a view too short for that, it stops at row 0's top. A leading row that
  appears or goes does not move the list to the focused row (#46).

## 0.3.0 — 2026-10-01

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
- **A fresh type-ahead letter searches after the focused row.** A letter that starts a new query —
  the first one, or one after a pause, a movement key, a miss or `end()` — searched from the focused
  row itself, so a focused row that matched kept focus: on `cherry`, `c` stayed on `cherry`, and ↓
  onto `cherry` then `c` did too. It now lands on the next match after the row, wrapping round, as the README
  said; the focused row is checked last, so a letter only it matches still lands on it. This holds
  for `useTypeAhead` and for `useTableKeyboard`'s `{ by: 'typeAhead' }` answer. A second, different
  letter still narrows from the row the first one landed on (#20).
- **`useTableKeyboard` and `useTypeAhead` require the type-ahead window**, `windowMs`: how long, in
  ms, a query stays open after its last key. There is no default; calling either without it is a
  type error. The window was a fixed 700 ms, so pass `{ windowMs: 700 }` to keep today's behaviour.
  A window of `0`, a negative one or `NaN` keeps no query open, and `Infinity` lets no pause end
  one. Called from JavaScript without it, neither hook throws: the window is `undefined`, no query
  stays open, and a name with a space in it can no longer be typed. `now` is unchanged (#27).

### Added

- **`TypeAheadOptions`**, the type of `useTypeAhead`'s and `useTableKeyboard`'s options:
  `windowMs`, and the optional `now` (#27).
- **`useColumnResize()`'s `begin` takes the pressing `button`** as an optional last argument. Given,
  the drag takes the release rules above; left out, any button's `mouseup` ends it, as before (#10).

### Fixed

- **The grid no longer renders on every scroll step, or twice a commit.** A scroll step rendered the
  grid even when the rows drawn stayed the same, and measuring the box after a commit rendered it a
  second time to find nothing changed, so `renderRow` ran about twice for each drawn row. Over 400
  scroll steps of 25 px with 28 px rows, the grid now commits only on the steps that move the drawn
  window (about one in nine) and never a second time. A scale or root font-size change made without
  a render is now picked up at the next render that is one, and a scroll inside a block no longer
  is (#32).
- **A stale or negative `focus` no longer throws.** A `focus` that names no row — `-1` from
  `indexOf` after a filter, an index past a shrunk list's end, a fraction, `NaN` — made a narrowing
  letter throw, and a fractional or `NaN` one made every letter throw; an index past the end
  searched after a row that did not exist and could skip the first match. Type-ahead now searches
  such a `focus` from the top, as `null`. A movement key still counts from an out-of-range integer
  and clamps where it lands, and now moves from a non-integer as from `null` rather than answering
  `2.5`.
  This holds for `useTypeAhead` and `useTableKeyboard` (#30).
- **`aria-activedescendant` names no row while `showRows` is `false`.** It named the focused row's id
  though no data row was drawn, so it pointed at an element that did not exist (#23).
- **Rows no longer overlap inside a scaled copy of the table.** Under a CSS `transform: scale(…)`
  the grid measured its row on screen but placed rows in the table's own px, so under `scale(0.5)`
  each row overlapped the next by half, about 1.5× the needed rows were drawn and Page Down moved
  twice as far. The row is now measured in the table's px; an unscaled grid is unchanged (#19).
- **A marquee inside a scaled copy of the table selects the rows under the pointer.** Under a CSS
  `transform: scale(…)` its geometry mixed screen and table px: under `scale(0.5)` a drag over rows
  3–6 selected 2–4, and under `scale(2)` a press in the lower part of the view was taken for a press
  on the scrollbar and started nothing. The marquee now measures the scale as the grid does, and its
  rectangle, its range and its scrollbar test follow the pointer at any uniform scale; an unscaled
  marquee is unchanged (#28).
- **A grid scrolled to its horizontal end shows its last column whole in Chromium.** When the
  scroller's reserved gutter held no scrollbar — a list too short to scroll vertically, or scrollbars
  hidden — Chromium stopped the scroll one gutter-width short, so the last 15 px or so of every row
  and of the header could not be reached. The grid now extends its content by the gutter in exactly
  that case, measured per browser; Firefox and a drawn scrollbar are unchanged. The scroller holds one
  more, hidden, element after the rows (#22).

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
