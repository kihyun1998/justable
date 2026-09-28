# Verification gates

## What it is

What checks a change before it is called done: `pnpm test` (Vitest over `src/**/*.test.{ts,tsx}`),
`pnpm typecheck`, and `pnpm build`. Two of the tests are package-level guards rather than unit tests:
the lint that the engine reaches nothing outside itself, and the test that every rendered class is
prefixed. There is no CI; every gate is run by hand.

## Governing decisions

**None.**

## Design model

- **The environment is chosen per file.** Vitest's default is Node; each component and hook test
  opts into jsdom with a `// @vitest-environment jsdom` first line. jsdom lays nothing out, so a grid
  test sees the unmeasured state unless it stubs a length — `TableGrid.test.tsx` stubs
  `HTMLElement.prototype.clientHeight` to reach the measured one — and a disabled grid is visible to
  a test only as `aria-disabled` and a class name, since jsdom compiles no CSS.
- **The lint finds the engine from its own file, not from a repo root** (`ENGINE` is `src/`), so it
  travelled into this package unchanged. It skips `src/lint` and every test file, and it **fails
  when it finds five or fewer sources** — a scope that matched nothing is not a pass.
- **The import rule**: every specifier is one of `EXTERNAL` (React, React DOM, the JSX runtime,
  `lucide-react`) or a relative path that, **resolved from the importing file, lands under `src/`**
  (`staysInside`). Judged by where it lands, not how it is spelled: `../../src/types.js` from
  `src/lib/` passes, and `../../src-other/x.js` fails although it shares the prefix — so the test is
  `path.relative`, never a string prefix or a count of `..`. Type-only imports count. The rule's own
  cases are pinned in the lint file on specifiers planted against a notional `src/lib/` importer
  (#2).
- **The colour rule** is [colour variables](colour-variables.md)' enforcement: every class-looking
  token in a string literal is stripped of its variants, and a colour-bearing root whose value is not
  `(--table-…)` fails. A literal `hover-ink` also fails — PenTerm's hover class, which the header
  reproduces in utilities.
- **The prefix test renders the grid with its header and a row, and the ruler**, and fails on any
  class not starting `justable:` (the icon set's own `lucide*` markers excepted).
- **The pure halves are tested apart** — `rowWindow.ts`, `tableKeyboard.ts`, `tableModel.ts` —
  because that is where off-by-ones live and where they are quiet: a row missing at the viewport's
  edge reads as a rendering glitch rather than a wrong number, and a component test cannot easily ask
  what End does in an empty list.
- **Layout is verified only in PenTerm.** jsdom measures nothing, so every width and alignment claim —
  auto-fit's widths, the tracks lining up, the colours resolving in scope — is checked only by
  PenTerm's browser checks (`check:guide`'s `explorer-table` group, including
  `explorer-table-double-click-auto-fits-the-column`, and `check:drawer-columns`) and its edge-scroll
  suite ([row windowing](row-windowing.md)). An engine change reaches them only after `pnpm build`
  here and an install there.
- **Class lists are checked as tokens, not regexes.** `TableRow.test.tsx` splits `TABLE_GRID` rather
  than matching it: a word-boundary escape once lost its backslash on the way into a file.
- **`example/` is where layout is seen in this repository.** `pnpm example` serves a consumer of the
  engine's source in a browser: no Tailwind and no preflight of its own, so it shows what a page
  without them gets. It found the header's sort buttons drawn with a browser's button styles, which
  PenTerm's preflight had always hidden ([header row](header-row.md)). `pnpm typecheck` covers it
  (`example/tsconfig.json`).
- **`pnpm check:example` is the layout gate** — the maintainer's call, 2026-09-28, to keep it in the
  repository. It serves the example with Vite, drives it in an installed Chrome or Edge, and checks
  what jsdom cannot: header and row tracks equal (at load, after a drag, after auto-fit), the sort
  button free of browser button styles, windowing, the sort cycle, type-ahead through a space, Space
  after a move, the theme through the colour variables, and a border held past the scroller's right
  edge scrolling the grid while the column keeps pace. It **exits 1 when no browser is found**,
  since a run that inspected nothing is not a pass. Proven failing: removing the button reset,
  dropping a placed row's `right: 0`, and refusing the space mid-query each fail it. The type-ahead
  check first asserts that "new" lands on `news.txt` — without that, `new folder` came first and the
  check passed with the space refused. The edge-scroll checks run on a 700 px page, so the table
  overflows before the name column reaches its maximum; they first assert that the grid scrolled, and
  read width and scroll after the release, once the loop has stopped. Proven failing: removing the
  scroll term, removing the release's last read, and unwiring the example's loop.
- **`src/lint` is excluded from the build**, so the lint ships in no package and runs only under
  `pnpm test`.

## Code

- `vitest.config.ts`
- `example/vite.config.ts`
- `example/FileTable.tsx` — `FileTable`
- `example/FolderList.tsx` — `FolderList`
- `example/tsconfig.json`
- `example/check.mjs`
- `package.json`
- `src/lint/the-engine-reaches-nothing-outside-itself.test.ts` — `sourceFiles`, `importViolations`, `staysInside`, `colourViolations`, `EXTERNAL`, `ENGINE`
- `src/components/prefix.test.tsx` — `unprefixed`
- `src/components/TableGrid.test.tsx`
- `src/components/TableHeader.test.tsx`
- `src/components/TableRow.test.tsx`
- `src/components/TableRuler.test.tsx`
- `src/hooks/useTableKeyboard.test.ts`
- `src/hooks/useTypeAhead.test.ts`
- `src/lib/tableModel.test.ts`
- `src/lib/rowWindow.test.ts`
- `src/lib/tableKeyboard.test.ts`
- `src/lib/classNames.test.ts`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the import rule is its mechanical half: the engine can name no consumer module.

## Blast radius

- [Colour variables](colour-variables.md) — the colour rule's idea of a colour utility.
- [Stylesheet and prefix](stylesheet-and-prefix.md) — the prefix test.
- [Package and release](package-and-release.md) — what the build excludes, and what it does not run.

## Known holes / open

- **The prefix test sees only the branches its renders take.** It renders the grid filling and not,
  enabled and disabled, and the header at rest and mid-drag; a class behind any other condition is
  unchecked until a render reaches it.
- **The lint reads `.ts` and `.tsx` only**; `src/style.css` is outside both rules.
- **The import pattern also matches import-shaped text in comments.** A comment quoting
  `from '../../x'` is judged as an import. Nothing in the tree does this today.
- **Two branches of `staysInside` are unexercised**: an inner directory whose name starts with `..`,
  and a specifier resolving to another drive (an absolute `path.relative`). Neither shape exists in
  the tree.
- **No CI.** Nothing runs any of this unless someone does. Tracked: #6.
- **`check:example` needs an installed browser**, and nothing runs it — there is no CI. Its "no
  browser" exit has not been exercised on a machine without one.
