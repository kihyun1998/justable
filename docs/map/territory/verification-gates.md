# Verification gates

## What it is

What checks a change before it is called done: `pnpm test` (Vitest over `src/**/*.test.{ts,tsx}` and
`example/**/*.test.{ts,tsx}`),
`pnpm typecheck`, and `pnpm build`. Two of the tests are package-level guards rather than unit tests:
the lint that the engine reaches nothing outside itself, and the test that every rendered class is
prefixed. CI runs every gate on each push and pull request (`.github/workflows/ci.yml`), and each can
be run by hand.

## Governing decisions

- **The example draws a leading row only under `?leading=1`** — the maintainer's call, 2026-10-01
  (#46), over a `..` row always drawn and over no browser check for leading rows. Shown: the
  example had no grid with leading rows, and `check.mjs` reads `aria-rowindex` 2 as the first data
  row in the track, gutter and marquee checks, so an always-drawn row would move every one of them.
  `App` reads the parameter and hands `FileTable` its `parentRow`. Theirs to reverse.
- **The inexact-scale check sweeps five depths, at about 3 s** — the maintainer's call, 2026-10-06
  (#47), over cutting it to three. Shown: `check:example` ran 19.14 and 19.49 s without it and 22.10
  and 22.08 s with it (Windows 11, Chrome, interleaved), against the ~1 s weighed in #47's triage,
  which had not been measured. Three depths was offered unmeasured. Theirs to reverse.

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
  moves pnpm too. Node 24 is the LTS; the maintainer develops on 26 (26.10.0 from 2026-10-01, past
  the exit abort's fix — see `check:example`'s exit below).

- **The environment is chosen per file.** Vitest's default is Node; each component and hook test
  opts into jsdom with a `// @vitest-environment jsdom` first line. jsdom lays nothing out, so a grid
  test sees the unmeasured state unless it stubs a length — `TableGrid.test.tsx` stubs
  `HTMLElement.prototype.clientHeight` to reach the measured one — and a disabled grid is visible to
  a test only as `aria-disabled` and a class name, since jsdom compiles no CSS. It does resolve the
  cascade, so a row's computed `height`, `box-sizing`, padding and borders are whatever style the
  test gives it (#47), and an unstyled row's `height` is `auto`. One trap there: with no border
  style, jsdom answers `border-top-width` as `medium`, where Chrome answers `0px` (2026-10-06), so
  a length read from computed style is parsed with a fallback to 0 (`lengthPx`).
- **When the grid renders is a jsdom test of its own** (`TableGrid.renders.test.tsx`, #32): a
  `Profiler` counts commits by phase, so a `nested-update` is told from an `update`, and it replaces
  `ResizeObserver` with one it can fire, since jsdom has none. One rerender from the parent is not
  enough to see a wasted render from a state updater: React runs an updater ahead of a render while
  the grid has no update pending, which held on every other rerender on `main`, so the case
  rerenders four times. A case that checks the window is computed from the offset now needs a new
  row height: within one row height, the offset now and the last one drawn are in the same block
  whenever no render happened between them.
- **The header lane's jsdom test is a file of its own** (`TableGrid.lane.test.tsx`), because the
  engine probe caches its answer per document and a test file shares one: the first grid rendered
  decides the probe for the rest of the file. It stubs `scrollLeft` to 0, since jsdom keeps an
  assigned `scrollLeft` (400 read back as 400, measured 2026-09-30), which makes the probe see an
  engine that scrolls all the way. Its release case changes only the content's width and asserts no
  commit: changing the viewport height as well commits the grid, and the commit re-measures the lane
  whether or not the release does (#25, measured by removing the release's lane measure).
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
- **The pure halves are tested apart** — `rowWindow.ts`, `tableKeyboard.ts`, `tableModel.ts`,
  `marquee.ts` —
  because that is where off-by-ones live and where they are quiet: a row missing at the viewport's
  edge reads as a rendering glitch rather than a wrong number, and a component test cannot easily ask
  what End does in an empty list.
- **Layout is verified only in a browser.** jsdom measures nothing, so every width and alignment
  claim — auto-fit's widths, the tracks lining up, the colours resolving in scope — is checked by
  `check:example` here (below) and by PenTerm's browser checks (`check:guide`'s `explorer-table`
  group, including `explorer-table-double-click-auto-fits-the-column`, and `check:drawer-columns`) and
  its edge-scroll suite ([row windowing](row-windowing.md)). An engine change reaches PenTerm's only
  after a release here and a version bump there.
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
  after a move, a click ending the type-ahead query, the theme through the colour variables, and a
  border held past the scroller's right edge scrolling the grid while the column keeps pace. It **exits 1 when no browser is found**,
  since a run that inspected nothing is not a pass. Proven failing: removing the button reset,
  dropping a placed row's `right: 0`, and refusing the space mid-query each fail it. The type-ahead
  check first asserts that "new" lands on `news.txt` — without that, `new folder` came first and the
  check passed with the space refused. The click check first asserts that "c" lands on
  `Cherry.png`, then clicks `new folder` and types "i": it lands on an `invoice-` row, where a query
  left running narrows "ci" to `citrus.csv` — proven failing by removing the example's `end()` on a
  click (#55). It also asserts that "c" to "i" took under the example's 700 ms window, since a run
  slow enough to let the query expire would pass with `end()` removed. The first marquee check on
  its fresh page also reads the grid's `:focus-visible` after that page's first press: false, and
  true with `focusVisible: false` removed from `useMarquee` (#58). The edge-scroll checks run on a 700 px page, so the table
  overflows before the name column reaches its maximum; they first assert that the grid scrolled, and
  read width and scroll after the release, once the loop has stopped. Proven failing: removing the
  scroll term, removing the release's last read, and unwiring the example's loop. A further check
  scrolls to the end and drags a border 20 px left: the column must shrink by 20. It fails when the
  grid never holds its content's width; it does not see the hold rising during a drag, which only the
  jsdom test pins.
- **Four checks hold a body cell against its row** ([table row](table-row.md)), right after the first
  track check and before anything sorts, drags or scrolls: a press 1.5 px inside the row's top and
  bottom edges lands on each cell; each cell's text sits within 0.5 px of where it sits when the cell
  is given the row's old centring (`align-self: center`, set inline and removed in the same read), so
  the reference is measured in the same browser and font rather than written down; a right-aligned
  cell keeps its text at its right padding; every cell computes `display: block`. Proven failing, one
  mutation of `TABLE_CELL` each: no stretch (the press), stretch alone (the position), a flex cell
  (the padding and the block), a grid cell (the block). The block check replaced an ellipsis check no
  cell change could fail — the example ellipses inside a span with its own overflow, which shrinks to
  the track whatever the cell's display — and a block box is what an ellipsis set on the cell itself,
  as PenTerm's cells set it, depends on.
- **`check:example` serves the example with no file watcher and no HMR** (`server.watch: null`,
  `server.hmr: false`, its own inline options; `vite.config.ts` and `pnpm example` keep both) (#42).
  The dev server otherwise swaps an edit under `src/` into the page under test: on 2026-10-01 another
  session's refactor in the same checkout failed 10 of 30 runs, with React's hook-order error,
  Puppeteer's "Execution context was destroyed" and single FAILs. **`watch: null` is the option that
  holds**: with no watcher Vite never invalidates a module it has transformed, so a page opened after
  an edit still gets the code from load time, and the check opens five more pages after its first.
  `hmr: false` alone stops updates to the open page, but a new page is served the edited file (a
  probe, 2026-10-01, Vite 8.3.1); it stays because without it there is no WebSocket server to push a
  reload. Proven failing: with the old options, an edit that throws in `useRowWindow`, made 1.5 s
  into the run and held to its end, fails the run; with `hmr: false` alone it fails too; with both
  options it passes.
- **`check:example` ends by setting `process.exitCode` and letting the process drain, not by
  `process.exit()`** (#39). On Windows, Node before 26.7.0 / 24.20.0 can abort while `process.exit()`
  tears down with V8 still running: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, exit
  3221226505 (`0xC0000409`), after every check has passed. It is Node's bug — a background task posts
  to the platform's wake-up handle after it was closed — fixed by nodejs/node#61999. A natural exit
  disposes V8 before that handle, which is why draining avoids it (read from Node 26.4.0's source,
  not measured directly). Measured on 2026-10-01, Windows 11, Chrome, `main` after #42, 41/41 every
  run: Node 26.4.0 with `process.exit()`, 2 aborts in 30 (and 1 in 5 more); Node 26.10.0 with
  `process.exit()`, 0 in 60; Node 26.4.0 draining, 0 in 60. Draining costs nothing: summary line to
  exit, 21–120 ms with `process.exit()` and 21–48 ms draining. The maintainer chose both the drain and
  upgrading the development machine's Node (2026-10-01). An `unref()`'d timer ends the run with the
  same code if a handle is still open five seconds on; it fired in none of those 60 runs. Proven
  failing: an open interval plus a failed check exits non-zero at 5.1 s; without `unref()` every run
  waits 5 s after its summary. The upstream regression test (`fetch` then `process.exit`) did not
  abort on 26.4.0 in 100 runs, so only this check reproduces it here.
- **`check:example` runs with Puppeteer's `--hide-scrollbars`, which leaves every reserved gutter
  empty** — the case in which Chromium withholds the gutter from the horizontal end
  ([header lane](header-lane.md)). So six checks hold that end (#22). On a page of their own, at
  700 px and scrolled to the end, the last cell meets the scrollport's edge and the header's last
  column ends where it does; at 1280 px the grid does not scroll horizontally at all and its rows end
  at the scrollport. A second Chrome with scrollbars drawn (`ignoreDefaultArgs: ['--hide-scrollbars']`)
  checks that the vertical scrollbar's filled gutter adds nothing: the end is the last cell, not past
  it. The scrolled-to-end border drag checks that the content is as wide while held as at the press,
  and that after the release no blank space is left past the last cell. Proven failing: never showing
  the spacer (15 px short), padding whenever there is a gutter (15 px past, in the drawn browser), a
  width hold that keeps the spacer (898 → 958 px while held), no re-measure at the release (20 px
  blank), and a spacer shown with nothing overflowing (a 1280 px grid that scrolls). Hiding the spacer to
  measure the content failed the existing 20 px drag check (it shrank by 35). Firefox and a short
  list are not in the gate: the app draws only the 5000-row grid, and Firefox is measured by hand.
- **Four checks hold a scaled copy of the grid** ([row windowing](row-windowing.md)), on a page of
  their own, last: the grid is measured unscaled, then under `transform: scale(0.5)` on the grid,
  each after Home → PageDown, whose first focus change is the render that measures (a one-px
  scroll was, until #32 made a scroll inside a block render nothing). Unscaled, rows are exactly
  one row's `offsetHeight` apart; scaled, they are that far apart within 0.05 px and overlap on
  screen by no more; and the drawn rows, the page and the canvas (within 0.05 px a row) are the
  unscaled ones. Since #47 read the row off the layout, `scale(0.5)` gives a step of exactly 28 and
  a canvas of exactly 140,000, where it gave 27.9913 and 139,957 before — so on the step and the
  canvas the 0.05 px stands as slack, not as the precision it was: that precision bounded the row
  while the row passed through a scale, and now bounds only the screen overlap. The fourth check is the inexact scales
  (#47): under `scale(0.83)`, at five scroll fractions through the 5,000 rows, no page error is
  raised and every row step equals the row's `offsetHeight`. It catches the render loop by its own
  sweep failing to read — a loop takes the tree down, so the check records the throw rather than
  ending the run, and the checks after it still report.
  Proven failing: reading the row on screen, undivided, rather than from its computed height fails
  six — the two scaled checks (step 14, 7 px overlap, 64 rows drawn, canvas 70,000, the page landing
  on 48), both `scale(0.5)` marquee drags, the inexact one and "no page errors" (39 of 45). The tree
  before #47 fails only the inexact one and "no page errors" — *Maximum update depth exceeded* with
  nothing read, 43 of 45 — and passed every `scale(0.5)` check, which is why those could not stand
  in for it. The inexact check sweeps `scale(0.83)` only; `scale(0.37)` and CSS `zoom` were swept by
  hand on 2026-10-06 ([row windowing](row-windowing.md)). Two older proofs are withdrawn with the reading they belonged to:
  dividing the row by 1 instead of the scale, and dropping the snap to 1 (step 27.9913), neither of
  which the row path can do any more. The scaled checks compare against the unscaled run, so they
  alone cannot see both runs drift together.
- **Three more drag a [marquee](marquee.md) in that scaled copy** (#28), on each row's third cell,
  away from the name, and each asserts the rectangle showed. Under `scale(0.5)`, at `scrollTop` 0, a
  drag over rows 3–6 selects 3–6; scrolled to 95 % of the list (past 100,000 px), a drag over four
  rows selects those four. Then the scroller is capped at 250 layout px and the grid drawn at
  `scale(2)`: a press on a row past the view's top plus its layout height, yet inside the view on
  screen, starts a marquee over the two rows dragged. That check finds its band wherever the grid
  is scrolled — the grid reveals its focused row after the resize, so it runs deep in the list. The
  cap is what makes the band exist inside an 800 px page; uncapped, the check found no row to press.
  Proven failing: the hook's scale forced to 1 fails all three (rows 2–4 selected at the top, as #28
  measured before its fix); the scale taken on the scroller alone fails the second (4731–4733 for
  4732–4735); the view's height left unscaled fails the third.
- **Three checks hold a reveal below a leading row** ([row windowing](row-windowing.md), #46), on a
  page of their own opened with `?leading=1`. Each reads layout px only — `offsetTop`, a row's
  `style.top`, `scrollTop` — so no scale enters the reading; a first version divided screen gaps by
  an unsnapped ratio and read 0.2 px where there was none. End brings the last row's bottom to the
  view's bottom; Home scrolls to 0 with the `..` row in view; under `scale(0.5)`, Home, End and two
  PageUps bring row 4956's top to the view's top, short of the scroll range's end, and the check
  asserts it is short of it. That last check first ran as End right after the unscaled End: the
  list was already at the end, the scale shrank the content, the browser clamped `scrollTop`, and
  the last row stayed in view whatever the reveal computed — it passed with the offset unmeasured
  and with the scroller's scale. Proven failing, one mutation each: the offset never measured fails
  End (−28 px) and the scaled PageUp (+28); the scroller's own scale for the offset fails the scaled
  PageUp (−43); row 0 revealed by nearest edge fails Home (`scrollTop` 28, the `..` row out). None
  of the three covers a leading row appearing under a scrolled-away list, nor row 0 in a view too
  short for it; the jsdom tests in `TableGrid.test.tsx` and `rowWindow.test.ts` hold those.
- **Two checks hold the row height's box model** ([row windowing](row-windowing.md), #50), on a
  page of their own, unscaled — a loop the inexact-scale check provokes cannot fail them too, and
  the rule takes no scale. A stylesheet injected into that page gives every `.row` a box model, then
  Home → PageDown makes the commit that measures: a style change alone is picked up only at the next
  render ([row windowing](row-windowing.md)'s known hole). A `border-box` row of `height: 32.5px`
  with 6 px of top padding, 2 px of bottom padding and a 1 px bottom border must be placed 32.5
  apart; a `content-box` row of `height: 20.5px` with the same padding and borders of 2 px on top
  and 1 px below must be placed 31.5 apart. Each also asserts the row's `offsetHeight` is within a
  px of that height, so a sheet that never applied cannot pass at the example's own 28. The numbers
  are chosen so that every wrong rule lands somewhere else: not 28, which is also the `rowHeightRem`
  fallback (1.75 × 16); fractional, which a whole-px `offsetHeight` reading rounds (33 and 32);
  top and bottom unequal, which a rule summing one side twice gets wrong; and the second unlike the
  first, so a second reading that never landed leaves the first's 32.5 and fails. Proven failing,
  each mutation applied and confirmed before the run — of `rowLayoutHeight`: the sum made
  unconditional fails the first (step 41.5); the sum never made fails the second (20.5); the
  fallback forced fails both (28); the row's `offsetHeight` read for its height fails both (33,
  43); the top padding summed twice fails the second (35.5) — and of the check: no render forced
  for the second fails it (32.5, the first's), and the sheet's selector matching nothing fails both
  (`offsetHeight` 28). A first version of the check, with whole and symmetric heights of 32, passed
  under the `offsetHeight` reading, a side summed twice, and a second reading that never landed.
  The page adds 1.2–2.6 s to the gate (27.14 → 29.71 s and 27.46 → 28.64 s, interleaved,
  2026-10-06, measured on that first version, which makes the same steps; the machine ran slower
  than for #47's timing, so only the pairs compare).
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
- `example/App.tsx` — `App`, `PARENT_ROW`
- `example/FileTable.tsx` — `FileTable`, `parentRow`
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
- `src/components/TableGrid.marquee.test.tsx`
- `src/components/TableGrid.lane.test.tsx`
- `src/components/TableGrid.renders.test.tsx`
- `src/components/TableHeader.test.tsx`
- `src/components/TableRow.test.tsx`
- `src/components/TableRuler.test.tsx`
- `src/hooks/useColumnResize.test.ts`
- `src/hooks/useTableKeyboard.test.ts`
- `src/hooks/useTypeAhead.test.ts`
- `src/lib/tableModel.test.ts`
- `src/lib/marquee.test.ts`
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
- **Without a watcher, the check is pinned only to modules already requested.** A module first
  requested after an edit is read from disk as it is then. Whether the first page requests every
  module the later pages use has not been measured.
- **The Vitest worker crash** seen once locally on 2026-09-28 did not recur in the first six CI runs.
- **Windows is not in CI**, and it is where the maintainer develops: a CRLF-only or path-only
  failure shows locally and not in CI. So does a runtime one: the exit abort above (#39) is
  Windows-only, and the CI runner never sees it.
- **The five-second fallback in `check:example` still exits through `process.exit()`**, so on a Node
  before the fix it can abort. With an open handle and a failed check it did abort (1 of 1), and the
  run stayed red. In a passing run the abort would turn green red; the fallback has not been seen to
  fire in a passing run.
