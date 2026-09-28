# justable

A windowed, keyboard-navigable data table for React: a column model (widths, hiding, a three-step
sort), a `role="grid"` scaffold that draws only the rows in view, a header with sort targets and
resize handles, rows that lay one cell per column, and an auto-fit ruler. It knows no domain — you
supply a column spec, the rows, and what goes in each cell.

## Install

```bash
pnpm add justable
```

Peer dependencies: `react` and `react-dom` 19, and `lucide-react` for the sort arrows.

Import the stylesheet once, at your app's entry:

```ts
import 'justable/style.css';
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
  its `end()` when you move the row), with `TypeAheadAnswer`; `useColumnResize`; `useColumnAutoFit`.
- **Windowing**, for any list of equal-height rows: `visibleRange`, `scrollToReveal`, `BLOCK_ROWS`,
  `UNMEASURED_ROWS`, with `RowWindow`, `VisibleRangeInput`, `RevealInput`.
- **Classes**: `TABLE_GRID` and `TABLE_CELL`, a row's grid and a cell's padding.

`TableHeader` takes a required `refusePress(event)`: the engine has no rule of its own about which
press starts a column resize. `(e) => e.button !== 0` is the simplest.

`TableGrid` announces `aria-multiselectable` only when you pass `multiselectable`: whether several
rows can be selected is your selection model, and the engine has none. It is off by default. A
grid that relied on it being always on — before this prop existed — passes `multiselectable` now.

## Develop

```bash
pnpm install
pnpm test
pnpm build   # dist/: ESM, type declarations, style.css
```

## License

MIT
