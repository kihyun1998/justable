<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/kihyun1998/justable/main/logo/readme/justable-lockup-white-trim.png">
    <img alt="justable" src="https://raw.githubusercontent.com/kihyun1998/justable/main/logo/readme/justable-lockup-black-trim.png" width="320">
  </picture>
</p>

# @kihyun1998/justable

A virtualized, keyboard-navigable data table for React. It draws only the rows in view — a
5,000-row list puts a few dozen rows in the page — and it brings sortable, resizable, hideable
columns, keyboard movement with type-ahead, and ARIA grid semantics.

It owns the table's mechanics and nothing about your data: you supply the columns, the rows and
what goes in each cell, and you keep the state — column widths, the sort, the focused row, the
selection. Colours come from CSS variables you bind.

## Install

```bash
pnpm add @kihyun1998/justable
```

Peer dependencies: `react` and `react-dom` 19, and `lucide-react` 0.500 or later (the sort arrows).

Import the stylesheet once, at your app's entry:

```ts
import '@kihyun1998/justable/style.css';
```

It holds the table's layout rules only. Every class is prefixed `justable:`, so none collides with
your own — you do not need Tailwind — and it resets nothing on your page.

## Quick start

A sortable, resizable table of people, moved through with the arrow keys:

```tsx
import {
  TableGrid,
  TableHeader,
  TableRow,
  createTableModel,
  useTableKeyboard,
  type ColumnLayout,
  type ColumnSpec,
  type TableSort,
} from '@kihyun1998/justable';
import '@kihyun1998/justable/style.css';
import { useMemo, useState } from 'react';

interface Person {
  name: string;
  age: number;
}

type Key = 'name' | 'age';

const COLUMNS: ColumnSpec<Person, Key>[] = [
  {
    key: 'name',
    defaultWidth: 200,
    minWidth: 80,
    maxWidth: 480,
    hideable: false,
    firstSortDesc: false,
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  {
    key: 'age',
    defaultWidth: 80,
    minWidth: 60,
    maxWidth: 160,
    hideable: true,
    firstSortDesc: true,
    compare: (a, b) => a.age - b.age,
  },
];

const LABELS: Record<Key, string> = { name: 'Name', age: 'Age' };

const model = createTableModel(COLUMNS);

export function People({ people }: { people: readonly Person[] }) {
  const [layout, setLayout] = useState<ColumnLayout<Key>>({ widths: {}, hidden: [] });
  const [sort, setSort] = useState<TableSort<Key>>();
  const [focus, setFocus] = useState<number | null>(null);
  const keyboard = useTableKeyboard({ windowMs: 700 });

  const rows = useMemo(() => model.sortRows(people, sort), [people, sort]);
  const columns = model.visibleColumns(layout);
  const gridStyle = { gridTemplateColumns: model.gridTemplate(layout) };

  return (
    <div
      style={{ height: 400, display: 'flex', flexDirection: 'column' }}
      onKeyDown={(e) => {
        const answer = keyboard.step(e, { focus, names: rows.map((p) => p.name) });
        if (answer?.to != null) setFocus(answer.to);
      }}
    >
      <TableGrid
        label="People"
        header={
          <TableHeader
            columns={columns.map((key) => ({
              key,
              label: LABELS[key],
              width: model.columnWidth(layout, key),
            }))}
            sort={sort}
            gridStyle={gridStyle}
            onSort={(key) => setSort((s) => model.nextSort(s, key))}
            onResize={(key, px) => setLayout((l) => model.withWidth(l, key, px))}
            resizeLabel="Resize column"
            refusePress={(e) => e.button !== 0}
          />
        }
        colCount={columns.length}
        total={rows.length}
        rowKey={(i) => rows[i]!.name}
        renderRow={(i, place) => (
          <TableRow
            id={place.id}
            rowIndex={place.rowIndex}
            style={place.style}
            columns={columns}
            gridStyle={gridStyle}
            className={place.focused ? 'row-focused' : undefined}
            onClick={() => setFocus(i)}
            cell={(key) => (key === 'name' ? rows[i]!.name : rows[i]!.age)}
          />
        )}
        fill
        focus={focus}
        rowIdPrefix="people"
        rowHeightRem={2}
        keyboard={keyboard.link}
      />
    </div>
  );
}
```

Three things to notice:

- **The state is yours.** `layout` (widths and hidden columns), `sort` and `focus` live in your
  component; the table reports what the user did and you decide what changes. Persist `layout` if
  you want widths to survive a reload.
- **Header and rows share one `gridStyle`.** It is the column template from `model.gridTemplate`;
  pass the same one to `TableHeader` and every `TableRow`, and the columns line up.
- **Give the grid a height.** `fill` makes it take the rest of a flex column; without a bounded
  height nothing scrolls, and every row is drawn.

Row colours — hover, focus, selection — are yours too: style the rows through `className`.

## How it fits together

| Piece | What it does |
|---|---|
| `createTableModel(columns)` | The column rules, as pure functions: widths clamped to each column's `minWidth`–`maxWidth`, hiding, the column template, the sort cycle, and `sortRows`. |
| `TableGrid` | The scrolling grid. It draws only the rows in view, and calls `renderRow(index, place)` for each. |
| `TableHeader` | The header row: one sort button per column, and a resize handle on each column's right border. |
| `TableRow` | One row: one cell per column, from `cell(key)`. Spread `place.id`, `place.rowIndex` and `place.style` onto it. |
| `useTableKeyboard` | Arrow keys, Home/End, Page Up/Down and type-ahead. You call its `step` from your own key handler, and its `end` when you move the row yourself. |
| `TableGrid`'s `marquee` | A rectangle dragged over the rows, reporting which rows it touches. |

**Rows must all be the same height.** The grid measures one drawn row and uses it for every row;
`rowHeightRem` is its estimate before that, and stands in while the measured row has no height of
its own (`display: contents`, say).

## Columns

Each `ColumnSpec` gives a column's `key`, its `defaultWidth`, `minWidth` and `maxWidth` in px,
whether it is `hideable`, the direction of its first sort (`firstSortDesc`), and a `compare` for
ascending order.

- **Sorting.** A header press calls `onSort(key)`; `model.nextSort(sort, key)` gives the next state:
  the column's first direction, then the other, then no sort. `model.sortRows(rows, sort)` returns a
  sorted copy.
- **Resizing.** Dragging a border calls `onResize(key, px)` with the unclamped width;
  `model.withWidth(layout, key, px)` clamps and stores it. `refusePress(event)` says which presses do
  *not* start a resize — `(e) => e.button !== 0` allows the primary button only. A drag ends at the
  release of the button that started it, or at the first move that finds that button no longer
  held.
- **Hiding.** `model.toggleHidden(layout, key)` hides or shows a `hideable` column;
  `model.visibleColumns(layout)` is what to draw. Pass its length to `TableGrid` as `colCount`.
- **Auto-fit.** `useColumnAutoFit()` measures the widest cell of a column. Render its `TableRuler`
  with `ref={rulerRef}` and `column={measuring}` while `measuring` is set — without the ref,
  `measure` answers `null` — and call `measure(key)` from `TableHeader`'s `onAutoFit`, a
  double-click on the border, then store the result with `withWidth`. `measureAll(keys)` fits several columns
  from one mount of the ruler and answers `{ [key]: px | null }`; store each non-null width the same
  way. See
  [`example/FileTable.tsx`](https://github.com/kihyun1998/justable/blob/main/example/FileTable.tsx).
- **Scrolling while resizing.** A border dragged past the grid's edge does not scroll the grid by
  itself. `onResizeDrag` gives you each move of the drag — the pointer and the grid's scroll
  container — then `null` when it ends, so you can scroll it with your own loop, at your own speed.
  However the grid scrolls, the border stays under the pointer. During a drag the grid does not get
  narrower, so blank space may show at its right edge until the button is released.
  [`example/edgeScroll.ts`](https://github.com/kihyun1998/justable/blob/main/example/edgeScroll.ts)
  is a loop to start from.

## Keyboard

The grid is one tab stop. Pass the `link` from `useTableKeyboard({ windowMs })` to it as `keyboard`,
and call `step(event, { focus, names })` from a `keydown` handler around it — `names` is each row's
text in screen order, for type-ahead. `windowMs` is yours and has no default: how long, in ms, a
query stays open after its last key. `0` keeps none open, so every letter starts a new query, and so
does a negative or `NaN` window; `Infinity` lets no pause end one. `step` answers:

- `{ by: 'move', to }` for ↑ ↓ Home End Page Up Page Down (a page is the rows in view);
- `{ by: 'typeAhead', to }` for a printable key: a row whose name starts with what was typed, each
  key within `windowMs` of the last, case-insensitively, or `to: null` when none does. A new query's
  letter, and the same letter pressed again, search after `focus`, wrapping round, with the `focus`
  row checked last, so a letter only it matches stays on it; with no `focus` they search from the
  top. Another letter narrows the query, searching from the `focus` row itself. A space continues a
  query in progress;
- `null` for any other key — Enter, Space, ← → — which is yours to handle.

On a move and on a type-ahead hit, `step` calls `preventDefault` on the event. A type-ahead miss
ends the query, so the next letter starts a fresh one.

When you move the row by other means — a click, a marquee, a list replaced by another folder's —
call the hook's `end()`, so the next letter starts a fresh query instead of extending one typed
against the old row or the old names. `end` is the same function for the hook's life, so an effect
can depend on it. Calling it from `step`'s own answer would end every query after one letter.

`focus` is a row index or `null`, and keeping it pointed at the right row — after a filter, say — is
yours. A `focus` that names no row — negative, past the end, fractional or `NaN` — is searched from
the top by type-ahead, as `null` is. A movement key counts from an out-of-range index and clamps
where it lands, so ↑ from past the end lands on the last row and ↓ from `-1` on the first; from a
non-integer it moves as from `null`.
Every `to` that `step` answers is a row index or `null`.

What a move does — focus only, or select too — is yours: the table selects nothing. The grid
scrolls the `focus` row into view whenever `focus` changes, and again when its height or the row
height changes.

## Marquee

Pass `marquee` to `TableGrid` to let a drag over the rows draw a rectangle, as a file explorer does.
The table draws it and tells you which rows it touches; what that selects is yours.

```tsx
<TableGrid
  // …
  marquee={{
    refusePress: (e) => e.button !== 0 || (e.target as Element).closest('[data-name]') !== null,
    threshold: 4,
    onMarquee: ({ phase, range, event, scroller }) => {
      // phase 'start': remember the selection; 'move' and 'end': lay `range` over it; 'cancel': put it back
    },
  }}
/>
```

- **Which press starts one.** Any press on the rows or on the empty space below them, unless
  `refusePress(event)` says no — a press on a file's name may be yours to drag, a right-click your
  context menu. A refused press is left entirely alone. An allowed one loses its default — the browser
  selects no text — and focuses the grid, whether or not it goes on to become a marquee, so refuse a
  press on anything in a row that takes focus itself, such as an input. A press on the scrollbar
  never starts one.
- **The threshold.** Nothing happens until the pointer has moved more than `threshold` px on either
  axis — px on screen, so inside a scaled copy of the table it is not scaled. A press that moves less
  is an ordinary click. After a real drag, the click the browser sends
  for the release reaches neither your row's `onClick` nor `onFloorClick`, nor does the double-click
  that follows when the drag began as a second click.
- **The range.** `{ anchor, head }`, in the same row indexes as `focus` and `renderRow`: `anchor` is
  the touched row nearest the press, `head` the one nearest the pointer, so `head < anchor` when
  dragging up. Only the rectangle's height counts: every row it overlaps top to bottom is touched,
  wherever it lies across. `null` while it touches no row. Each report carries the whole range, never
  a change to it, so apply it over the selection you had at `start` rather than over the last one.
- **Reports.** `'start'` when the threshold is passed, `'move'` on every pointer move and on every
  scroll that changes the range, `'end'` at the release of the button that started it (or at the
  first move that finds it no longer held), `'cancel'` on Escape, when the window loses focus, or
  when a new press starts over. The Escape then reaches no handler on the document or an element; a
  capture listener on `window` itself still hears it. `event` is the drag's
  latest mouse event, for its modifiers. A grid removed mid-drag reports nothing more.
- **Scrolling.** The table never scrolls for a drag. `scroller` is the grid's scroll container: scroll
  it from your own loop when the pointer nears an edge, as
  [`example/edgeScroll.ts`](https://github.com/kihyun1998/justable/blob/main/example/edgeScroll.ts)
  does. The rectangle stays anchored where it was pressed while the rows scroll under it, and a
  pointer past the grid's edge counts at that edge.
- **Mouse only.** Touch and pen do not draw one.

[`example/FileTable.tsx`](https://github.com/kihyun1998/justable/blob/main/example/FileTable.tsx)
replaces the selection on a plain drag, toggles with Ctrl or ⌘, and adds with Shift.

## Colours

The table paints colour only through CSS variables, with no defaults. Bind them on the table's root,
which carries `data-table`:

```css
[data-table] {
  --table-header-bg: #f6f8fa;
  --table-header-ink: #1f2328;
  --table-border: #d0d7de;
  --table-resize-line: #d0d7de;
  --table-resize-line-hover: #8c959f;
  --table-resize-line-active: #0969da;
  --table-hover: rgb(0 0 0 / 0.04);
  --table-focus-ring: #0969da;
  --table-marquee-fill: rgb(9 105 218 / 0.12);
  --table-marquee-border: #0969da;
}
```

| Variable | Paints |
|---|---|
| `--table-header-bg` | the header row's background |
| `--table-header-ink` | the header labels |
| `--table-border` | the line under the header |
| `--table-resize-line` | a column border at rest |
| `--table-resize-line-hover` | a column border under the pointer |
| `--table-resize-line-active` | a column border being dragged |
| `--table-hover` | a header cell's hover background |
| `--table-focus-ring` | a header cell's keyboard focus ring |
| `--table-marquee-fill` | the marquee rectangle's inside |
| `--table-marquee-border` | the marquee rectangle's edge |

If you point them at your own design tokens (`var(--border)`), bind them on `[data-table]` rather
than `:root`: a variable holding `var(--x)` is resolved where it is declared, so a theme that
redefines `--x` further down the page only reaches the table if the binding sits on the table.

The table's parts carry stable data attributes to select by: `data-table` on the root,
`data-table-header` on the header row, `data-table-resize="<key>"` on a column's resize handle,
`data-table-marquee` on the marquee rectangle, and `data-table-ruler="<key>"` on an auto-fit ruler
while it measures.

## Accessibility

- The grid is `role="grid"` with one tab stop; the focused row is announced through
  `aria-activedescendant`, and rows and cells carry their row and column indexes.
- `label` names the grid. `colCount` is the number of drawn columns, for `aria-colcount`.
- `aria-selected` on a row is yours to set. Pass `multiselectable` when several rows can be selected
  at once; it is off by default.
- A `disabled` grid ignores the pointer and says `aria-disabled`, but stays focusable, so a screen
  reader user can still find it. Whether keys do anything then is yours: don't act on `step`'s
  answer while it is disabled.

## Lists that are not a table

For a list with its own markup and movement — a sidebar, a tree:

- `useTypeAhead({ windowMs })` is the table's type-ahead alone: call its
  `step(event, { focus, names })` from your key handler, and its `end()` whenever the list moves by
  other means. It answers `{ to }` by the same rules, and takes the same `windowMs` and `focus`, as
  the grid's type-ahead above.
- `visibleRange({ scrollTop, viewportHeight, rowHeight, total, canvasTop })` is the window of rows to
  draw, and `scrollToReveal(index, { scrollTop, viewportHeight, rowHeight, canvasTop })` the
  `scrollTop` that brings a row into view, or `null` if it already is. Both take equal-height rows.
  `canvasTop` (optional, 0) is where row 0 starts in the scroller's content — below any rows drawn
  above the list. Revealing row 0 upward scrolls to 0, so those rows show with it, when row 0 then
  fits in the view.
- `BLOCK_ROWS` (8): the window's start snaps to a multiple of it, and a whole block is drawn past
  each edge, so 8 to 15 extra rows sit above the view and as many plus a row or two below.
  `UNMEASURED_ROWS` (200) is how many are drawn before the viewport has been measured.

## Less common props

- **`TableGrid`**:
  - `leadingRows`: rows drawn above the data, each told its `aria-rowindex`, never windowed.
  - `showRows={false}`: draws no data rows, for when you show something else instead.
  - `wrapScroller`: wraps the scroll container, for example in a context-menu trigger.
  - `scrollerProps`: extra attributes on the scroll container. They are spread after the grid's
    own, so a `role` there replaces `rowgroup`.
- **`TableHeader`**:
  - `scale`: screen px per table px, for a scaled copy of the table, so a border drag follows the
    pointer.
  - `className`: goes on the header row, for its height and type.
- **`TableRow`**: `cellClassName(key)` and `cellTitle(key)` give each cell a class and a `title`.
- **The model**:
  - `clampWidth(px, key)` is the clamp `withWidth` applies.
  - `isHidden(layout, key)` tells whether a column is hidden.
  - `sortRows(rows, sort, tieBreak)` orders ties by `tieBreak`.
- **`useTableKeyboard({ windowMs, now })` and `useTypeAhead({ windowMs, now })`**: `now` is the clock
  the type-ahead window is timed with, for tests.
- **`useColumnResize(onResize, onDrag)`**: the border drag `TableHeader` uses, for a handle you
  draw yourself. `begin(key, startWidth, startX, scale?, scroller?, holdWidth?, button?)` starts
  one from your `mousedown`. Pass the event's `button` so that only that button's release ends it.

## Exports

- **Model**: `createTableModel`; types `TableModel`, `ColumnSpec`, `ColumnLayout`, `TableSort`,
  `HeaderColumn`.
- **Components**: `TableGrid`, `TableHeader`, `TableRow`, `TableRuler`; types `TableGridProps`,
  `RowPlace`, `TableHeaderProps`, `TableRowProps`, `TableRulerProps`.
- **Marquee**: types `MarqueeOptions`, `MarqueeReport`, `MarqueePhase`, `MarqueeRange`.
- **Hooks**: `useTableKeyboard` (types `TableKeyEvent`, `TableKeyStep`, `TableKeyboardLink`),
  `useTypeAhead` (`TypeAheadAnswer`, `TypeAheadOptions`, the options of both hooks),
  `useColumnResize` (`ResizeDrag`), `useColumnAutoFit`.
- **Windowing**: `visibleRange`, `scrollToReveal`, `BLOCK_ROWS`, `UNMEASURED_ROWS`; types
  `RowWindow`, `VisibleRangeInput`, `RevealInput`.
- **Classes**: `TABLE_GRID` and `TABLE_CELL`, a row's grid layout and a cell — padded, as tall as its
  row, its content centred — for rows you draw yourself.

## Develop

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build           # dist/: ESM, type declarations, style.css
pnpm example         # example/ in a browser, against src/ — an edit to the table reloads it
pnpm check:example   # the example driven in an installed Chrome or Edge (CHROME_PATH to choose)
```

`example/` is a file list of 5,000 rows and a folder list beside it, wired as an app would wire
them: sorting, resize and auto-fit, hiding columns, keyboard movement and type-ahead,
multi-selection, and the colours bound for a light and a dark theme. It is not part of the package.
The quick start above is `example/QuickStart.tsx`, and a test keeps the two identical.

CI runs every one of these, and the map check (`python .github/scripts/check_map.py`), on every push
and pull request.

### Releasing

1. Pick the version: until 1.0, a breaking change to the exports or to how one behaves bumps the
   minor, anything else the patch.
2. Set it in `package.json`, and turn `CHANGELOG.md`'s unreleased entry into that version with the
   date — breaking changes first.
3. Commit, then push a tag `v<version>`. CI runs every gate, checks that the tag names
   `package.json`'s version, and publishes to npm. A mismatched tag fails before anything is
   published.

npm never takes the same version twice, so a bad release is fixed by the next one.

## License

MIT
