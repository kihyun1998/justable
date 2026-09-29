# Verification gates

## What it is

What checks a change before it is called done: `pnpm test` (Vitest over `src/**/*.test.{ts,tsx}` and
`example/**/*.test.{ts,tsx}`),
`pnpm typecheck`, and `pnpm build`. Two of the tests are package-level guards rather than unit tests:
the lint that the engine reaches nothing outside itself, and the test that every rendered class is
prefixed. CI runs every gate on each push and pull request (`.github/workflows/ci.yml`), and each can
be run by hand.

## Governing decisions

**None.**

## Design model

- **CI runs every gate, each as its own step** — test, typecheck, build, the map check's
  `--selftest`, the map check, and `check:example` — on Ubuntu 24.04, for every push and pull
  request, so a red run names its gate. Three calls are the maintainer's (2026-09-29, #6): the map
  check is **vendored** into `.github/scripts/check_map.py` rather than left local-only, because the
  skills repository it comes from is private and CI cannot fetch it; `check:example` **runs in CI**
  rather than local-only; and the runner is **Ubuntu only**, over Ubuntu and Windows. Chrome comes with
  the runner image (actions/runner-images `c9dd57c6b6`, `Ubuntu2404-Readme.md`); the first run found
  it at `/usr/bin/google-chrome`, the path `check:example` tries.
- **Each gate has been seen failing in CI**, 2026-09-29, each from one planted break on a throwaway
  branch, and each at its own step with the steps after it skipped: a wrong expectation (test), a
  wrong annotation in the example (typecheck), an `@import` of a missing file in `src/style.css`
  (build), a broken anchor (map check), and the example's edge-scroll speed set to 0 (browser check).
  A plant must pass every gate before its own: the first browser plant, the example's loop unwired,
  failed at typecheck instead, since it left a variable unused. The map check's `--selftest` was not
  planted; it runs the checker against its own defect fixtures.
- **The vendored map check is a fork.** Its `BUILD_STAMP` names the skills commit it was copied from
  (`0a76ff1`); apart from that line it was identical on 2026-09-29. It gains nothing when the
  original gains a rule — re-copy it, and diff before assuming they match.
- **The README's quick start is a file under test.** `example/QuickStart.tsx` is typechecked with the
  example, `example/QuickStart.test.tsx` renders it (header, rows, a sort, a keyboard move), and the
  same test requires the README's `tsx` block under `## Quick start` to equal the file. Vitest maps
  `@kihyun1998/justable` and its `style.css` to `src/` (`vitest.config.ts`), as the example's Vite
  config does. Proven failing: an edited README block, and the quick start without its key handler or
  its sort. The README's other snippets are not checked.
- **Node 24 and pnpm 10.28.0 in CI.** pnpm is pinned by `packageManager` in `package.json`;
  `pnpm/action-setup` v6 reads it. Its successor, `pnpm/setup`, requires pnpm 11, so moving to it
  moves pnpm too. Node 24 is the LTS; the maintainer develops on 26.

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
- **Layout is verified only in a browser.** jsdom measures nothing, so every width and alignment
  claim — auto-fit's widths, the tracks lining up, the colours resolving in scope — is checked by
  `check:example` here (below) and by PenTerm's browser checks (`check:guide`'s `explorer-table`
  group, including `explorer-table-double-click-auto-fits-the-column`, and `check:drawer-columns`) and
  its edge-scroll suite ([row windowing](row-windowing.md)). An engine change reaches PenTerm's only
  after `pnpm build` here and an install there.
- **Class lists are checked as tokens, not regexes.** `TableRow.test.tsx` splits `TABLE_GRID` rather
  than matching it: a word-boundary escape once lost its backslash on the way into a file.
- **`example/` is where layout is seen in this repository.** `pnpm example` serves a consumer of the
  engine's source in a browser: no Tailwind and no preflight of its own, so it shows what a page
  without them gets. It found the header's sort buttons drawn with a browser's button styles, which
  PenTerm's preflight had always hidden ([header row](header-row.md)). `pnpm typecheck` covers it
  (`example/tsconfig.json`).
- **`pnpm check:example` is the layout gate** — the maintainer's call, 2026-09-28, to keep it in the
  repository. It serves the example with Vite, drives it in an installed Chrome or Edge, and checks
  what jsdom cannot: header and row tracks equal (at load, after a drag, after auto-fit, after fit all), fit all
  answering each column's double-click width — the check first asserts that fit all moved the
  widths, which it must since the name column was dragged 100 px wider just before, and then that a
  double-click on every border changes none of them — the sort
  button free of browser button styles, windowing, the sort cycle, type-ahead through a space, Space
  after a move, the theme through the colour variables, and a border held past the scroller's right
  edge scrolling the grid while the column keeps pace. It **exits 1 when no browser is found**,
  since a run that inspected nothing is not a pass. Proven failing: removing the button reset,
  dropping a placed row's `right: 0`, and refusing the space mid-query each fail it. The type-ahead
  check first asserts that "new" lands on `news.txt` — without that, `new folder` came first and the
  check passed with the space refused. The edge-scroll checks run on a 700 px page, so the table
  overflows before the name column reaches its maximum; they first assert that the grid scrolled, and
  read width and scroll after the release, once the loop has stopped. Proven failing: removing the
  scroll term, removing the release's last read, and unwiring the example's loop. A further check
  scrolls to the end and drags a border 20 px left: the column must shrink by 20. It fails when the
  grid never holds its content's width; it does not see the hold rising during a drag, which only the
  jsdom test pins.
- **The [marquee](marquee.md)'s browser checks run on a page of their own**, so nothing above has
  scrolled or selected: a drag over four rows selects those four and leaves the grid focused, the
  rectangle shows in its bound colours and hides at the release, a drag held past the bottom edge
  scrolls the grid, Escape puts the selection back, a Ctrl drag inside one row adds that row, a press
  on a name's text starts none while one beside it in the name column does, and a disabled grid
  draws none — which only a browser sees, since it rests on a class. The name check was added after
  the example refused the whole name column: its name span was `display: block`, so it measured
  x 268–512 in a 260–520 cell around text at 268–359, and every press in the column landed on it.
  The span is now as wide as its text (`.file-name`), up to the cell, where a long name still ends in
  an ellipsis (measured: 244 px, the cell's content width). Proven failing on the block span.
  The last is the only one that can see the click swallow: the click lands on the press's and
  release's common ancestor, so a drag across rows sends it to the canvas, where nothing listens.
  That check scrolls back to the top first — the drag before it left its row above the view, and the
  press landed on the header. Proven failing: removing the swallow, inverting its `detail` test,
  removing the grid's focus, removing the example's restore on `cancel`, scrolling the example's
  marquee on `'x'` only, and removing the disabled grid's `pointer-events-none`. A check that the rectangle never enlarged the scroll area was dropped: with
  the pointer clamped to the view and 5,000 rows, the rectangle cannot reach the content's edge there,
  so it could not fail; the jsdom test holds it.
- **`src/lint` is excluded from the build**, so the lint ships in no package and runs only under
  `pnpm test`.

## Code

- `vitest.config.ts`
- `example/vite.config.ts`
- `example/FileTable.tsx` — `FileTable`
- `example/FolderList.tsx` — `FolderList`
- `example/tsconfig.json`
- `example/check.mjs`
- `example/QuickStart.tsx` — `People`
- `example/QuickStart.test.tsx`
- `package.json`
- `.github/workflows/ci.yml`
- `.github/scripts/check_map.py`
- `.checkup.json`
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
- **`check:example`'s "no browser" exit has not been exercised** on a machine without one.
- **The Vitest worker crash** seen once locally on 2026-09-28 did not recur in the first six CI runs.
- **Windows is not in CI**, and it is where the maintainer develops: a CRLF-only or path-only
  failure shows locally and not in CI.
