# justable

A windowed, keyboard-navigable data table for React: a column model (widths, hiding, a three-step
sort), a `role="grid"` scaffold that draws only the rows in view, a header with sort targets and
resize handles, rows that lay one cell per column, and an auto-fit ruler. It knows no domain — you
supply a column spec, the rows, and what goes in each cell.

## Install

```bash
pnpm add @kihyun1998/justable
```

Peer dependencies: `react` and `react-dom` 19, and `lucide-react` for the sort arrows.

Import the stylesheet once, at your app's entry:

```ts
import '@kihyun1998/justable/style.css';
```

It holds the package's layout utilities only, every class prefixed `justable:` so none collides with
your own Tailwind (if you use it — you do not need to). It resets nothing on your page.

## Colours

The table paints colour only through CSS variables. Bind them **on the table** — the grid root
carries `data-table` — so they resolve against the tokens of whatever scope the table sits in:

```css
[data-table] {
  --table-header-bg: var(--card);
  --table-header-ink: var(--foreground);
  --table-border: var(--border);
  --table-resize-line: var(--border);
  --table-resize-line-hover: var(--muted-foreground);
  --table-resize-line-active: var(--primary);
  --table-hover: var(--hover);
  --table-focus-ring: var(--ring);
}
```

| Variable | Paints |
|---|---|
| `--table-header-bg` | the header row's surface |
| `--table-header-ink` | the header labels |
| `--table-border` | the header's bottom border |
| `--table-resize-line` | a column border at rest |
| `--table-resize-line-hover` | a column border under the pointer |
| `--table-resize-line-active` | a column border being dragged |
| `--table-hover` | a header cell's hover fill |
| `--table-focus-ring` | a header cell's keyboard focus ring |

There are no fallbacks. Bind them at `:root` only if nothing on your page redefines the tokens they
point at: a custom property holding `var(--x)` is computed where it is declared.

Row colours — hover, selection, focus — are yours: pass them as row classes.

## Exports

- **Model**: `createTableModel(spec)` binds widths, hiding, the grid template and the sort cycle to
  a `ColumnSpec[]`. Types: `TableModel`, `ColumnSpec`, `ColumnLayout`, `TableSort`, `HeaderColumn`.
- **Components**: `TableGrid` (the windowed grid), `TableHeader`, `TableRow`, `TableRuler`, with
  `TableGridProps`, `RowPlace`, `TableHeaderProps`, `TableRowProps`, `TableRulerProps`.
- **Hooks**: `useTableKeyboard` (movement and type-ahead; you call its `step` from your own key
  handler and decide what a move selects), with `TableKeyEvent`, `TableKeyStep`,
  `TableKeyboardLink`; `useTypeAhead` (type-ahead alone, for a list whose movement is your own — call
  its `end()` when you move the row), with `TypeAheadAnswer`; `useColumnResize`, with `ResizeDrag`; `useColumnAutoFit`.
- **Windowing**, for any list of equal-height rows: `visibleRange`, `scrollToReveal`, `BLOCK_ROWS`,
  `UNMEASURED_ROWS`, with `RowWindow`, `VisibleRangeInput`, `RevealInput`.
- **Classes**: `TABLE_GRID` and `TABLE_CELL`, a row's grid and a cell's padding.

`TableHeader` takes a required `refusePress(event)`: the engine has no rule of its own about which
press starts a column resize. `(e) => e.button !== 0` is the simplest.

A border dragged past the grid's edge does not scroll the grid by itself. `TableHeader`'s
`onResizeDrag` hands you each move of a running drag — the pointer and the grid's scroller — then
`null` when it ends; scroll the scroller from there with your own edge-scroll loop. Whatever scrolls
it, the column keeps widening by the distance scrolled, so the border stays under the pointer.
`example/edgeScroll.ts` is a small loop to start from.

`TableGrid` takes `colCount`, the number of drawn columns, for `aria-colcount`: pass
`model.visibleColumns(layout).length`. The grid receives the header as an element and cannot count
it.

A `disabled` grid stops pointer input and says `aria-disabled`, but keeps its focus, so a screen
reader user can still find it. Whether keys do anything is yours: don't act on `step`'s answer while
it is disabled.

The engine marks its parts with data attributes you can select by, in your own styles or checks,
and they are kept stable: `data-table` on the grid root, `data-table-header` on the header row,
`data-table-resize="<key>"` on each column's resize handle, and `data-table-ruler="<key>"` on an
auto-fit ruler while it measures.

`TableGrid` announces `aria-multiselectable` only when you pass `multiselectable`: whether several
rows can be selected is your selection model, and the engine has none. It is off by default. A
grid that relied on it being always on — before this prop existed — passes `multiselectable` now.

## Develop

```bash
pnpm install
pnpm test
pnpm build     # dist/: ESM, type declarations, style.css
pnpm example   # example/ in a browser, against src/ — an edit to the engine reloads it
pnpm check:example   # the example driven in an installed Chrome or Edge (CHROME_PATH to choose)
```

CI runs all of these, `pnpm typecheck` and the map check (`python .github/scripts/check_map.py`) on
every push and pull request.

### Releasing

1. Pick the version: from 0.x, a breaking change to the exports or to how one behaves bumps the
   minor, anything else the patch.
2. Set it in `package.json`, and turn `CHANGELOG.md`'s unreleased entry into that version with the
   date — breaking changes first.
3. Commit, then push a tag `v<version>`. CI runs every gate, checks the tag names `package.json`'s
   version, and publishes to npm. A mismatched tag fails before anything is published.

npm never takes the same version twice, so a bad release is fixed by the next one.

`example/` is a file list of 5,000 rows and a folder list beside it, wired the way a consumer
would: sorting, column resize and auto-fit, hiding columns, keyboard movement and type-ahead,
multi-selection, and the colour variables bound for a light and a dark theme. It uses no Tailwind of
its own and is not part of the package.

## License

MIT
