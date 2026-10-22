# MAP — justable

<!-- grill-map build stamp: e1ef9ba -->
<!-- grill-map synced at: f0b2175 (2026-10-16) -->

The layer that answers the two questions no other artifact here can, because every other artifact is
indexed by an event — a commit, an issue — and none is indexed by what the package does.

| Question | Open |
|---|---|
| **If I touch this, what else moves?** | the territory note for what you are touching, then its `## Blast radius` — read it as a **checklist**. Opening a listed territory and finding nothing to do is a correct outcome; not opening it is the failure this layer exists to prevent. Then its `## Cross-cutting invariants`, the same way |
| **What is this derived from?** | the same note's `## Governing decisions` (who decided) and `## Reference behaviour` (what it was checked against). A `**None.**` there is the answer, not an omission |

Written in English, as the README and `CLAUDE.md` are: an agent reads this at the start of a task.

## The system, in one paragraph

`@kihyun1998/justable` is a React package that owns a data table's mechanics and nothing about its
data or its state. A pure [column model](territory/column-model.md) turns the consumer's spec and
stored layout into widths, the drawn columns, their order and the grid template, and walks the sort
cycle. A windowed `role="grid"` ([grid scaffold](territory/grid-scaffold.md)) draws only the rows in
view from one measured row ([row windowing](territory/row-windowing.md)) under a
[header lane](territory/header-lane.md) that follows the rows' horizontal scroll. The
[header row](territory/header-row.md) is a sort button per column, with a border
[column resize](territory/column-resize.md), a [column move](territory/column-move.md) drag and an
[auto-fit](territory/auto-fit.md) on its handles; [table row](territory/table-row.md)s draw one cell
per column. [Keyboard movement](territory/keyboard-movement.md) and type-ahead answer where a key
goes; the [marquee](territory/marquee.md) answers which rows a rectangle touches; all three drags run
on one [drag lifetime](territory/drag-lifetime.md). Colour comes only through
[`--table-*` variables](territory/colour-variables.md), and every class through a
[prefixed stylesheet](territory/stylesheet-and-prefix.md). It leaves the repo by a tag
([package and release](territory/package-and-release.md)) once every
[gate](territory/verification-gates.md) is green. Read at `f0b2175`, 2026-10-22.

## The failure that justifies this layer

The engine was moved out of PenTerm in one commit (`6236425`), and its reasoning did not come with
it. Two source comments arrived citing map notes by path — `rowWindow.ts` named `table.md`,
`tableKeyboard.ts` named `table-engine.md` — and neither existed in this repository; the second was
PenTerm's, and the first was never a file in either repository — the path was wrong from the commit
that wrote it (`penterm 1b3bc40a3`). Both now name the notes here. Every measurement that fixes a
constant here (`BLOCK_ROWS`, `UNMEASURED_ROWS`, the `right: 0` on a placed row, the lane's `clip`)
lived in a consumer's repository, where the next person to change the engine would not look.

## PenTerm provenance

PenTerm is the one consumer, and the other side of this package's boundary. Most `## Design model`
content here was first led by PenTerm's note on this engine and then **checked against this
repository's code** before it was written; a line the code did not bear out was left out or
corrected (one example: PenTerm's note says the test suites always see the unmeasured grid, and
`TableGrid.test.tsx` here stubs `clientHeight` to reach the measured one).

- **The lead**: PenTerm `docs/map/territory/table-engine.md` at PenTerm commit `73fad8b77`
  (the note last changed in `0fab5f2f9`). PenTerm does not resolve as `kihyun1998/penterm` on
  GitHub, so this is cited as text and cannot be a link.
- **The seam, read 2026-10-22 at `penterm 7dadc3c95`**: `package.json` pins `@kihyun1998/justable`
  at exactly `0.5.0`; the stylesheet is imported in `src/blocks/explorer/registerExplorerKind.ts`
  and `src/harness/main.tsx`; the `--table-*` roles are bound on `[data-table]` in
  `src/global.css`, which also styles `[data-table-sliding]`, `[data-table-moving]` and reads
  `--justable-moving`; the package is imported from 18 files under `src/blocks/explorer/`,
  `src/harness/` and `src/surfaces/`. Its ADR-0099, ADR-0100 and ADR-0122 decide PenTerm's own use
  of the column border and the column move, not this package.
- **"(PenTerm)" after a number** means it was measured in PenTerm's app, in PenTerm's scopes, and has
  not been re-measured here. It is evidence for the rule, not a property of this package's tests.
- **`penterm <sha>`** is a commit in that repository.
- PenTerm's note keeps its consumer side — its `--table-*` binding, how it installs this package, its
  own checks. What that note still says about the engine itself is a second copy; reducing it to a
  pointer here is PenTerm's change to make, not this map's.

## What the orientation found that no note owns

Commands, not numbers: a number stored here competes with the tree that produces it.

```sh
rg -c '^export|^  [A-Za-z]' src/index.ts          # the public surface, by export line
ls docs/adr GLOSSARY.md 2>/dev/null                 # records governing it (none, 2026-10-22)
rg -n 'docs/map/[A-Za-z/.-]+\.md' src example       # source comments citing a note by path
gh issue list --state open                         # the open backlog
```

- **Every public promise is ungoverned by a record in the repo.** There is no `docs/adr/` and no
  `GLOSSARY.md` (re-checked 2026-10-22). The maintainer's calls are recorded in the notes they
  govern, from #8 on, each with what was shown; `.out-of-scope/` holds the two declined requests
  (#34, #67) with their reasons. Which notes still hold no decision is the sentinel query under
  Conventions, not a list here.
- **The stale pointers were in source, not prose** (found by this map's first version): the two
  comment paths above, test headers citing PenTerm's files by path, and the lint's alias for
  PenTerm's tree, which permitted an import that could never build here. Source comments now cite
  notes by path — the checker's comment-citation pass counts them — so a renamed note is a red CI.
- **Nothing is open** (`gh issue list --state open`, 2026-10-22, empty), and no roadmap or TODO
  register exists. What is not built is recorded only in each note's `## Known holes / open`.
- **`TableGrid.tsx` was once about half of the component layer** and three territories in one
  function, `measureBox`; #25 split [row windowing](territory/row-windowing.md) and
  [header lane](territory/header-lane.md) into hooks. What they still share is the scroller, its
  scroll event, the width hold's release and a read order; each note's `## Blast radius` says how.

## How this is read and written

- **Read before designing a change**: this hub, the territory for what you are touching, then its
  `## Blast radius` and `## Cross-cutting invariants` as a checklist.
- **Write after it lands**: a change that alters a rule updates the note in the same change, and
  `CLAUDE.md` § Comments sends a comment's why, trap and measured value here.
- **Promotion, at the first fix**: ask whether the fact holds at every site that shares the
  assumption. Here the shared assumptions are few and nameable: *does this code read a length from
  layout? on screen or in layout px? does it number rows or columns? does it choose what a gesture
  or key means?* If yes, the fact goes in an invariant note before the fix lands.

## Conventions

- **Empty sections stay**, and `**None.**` is the sentinel. It marks three different holes — nobody
  decided, nobody checked against a reference, nobody built it — so every query for it names its
  heading:

  ```sh
  rg -lU '## Governing decisions\r?\n(\r?\n)?\*\*None\.\*\*' docs/map/territory/
  rg -lU '## Reference behaviour\r?\n(\r?\n)?\*\*None\.\*\*' docs/map/territory/
  ls docs/map/territory/ docs/map/invariant/        # what exists; the folder is the roster
  ```

- **Territories overlap.** A fact that holds in several is an invariant note, not a copy.
- **Symbols, never line numbers.**
- **Plain relative markdown links**, not `[[wikilinks]]`.
- **Link a fact, never restate it.** The `--table-*` roster is owned by `README.md` § Colours
  (published); the export list by `src/index.ts`. Notes point at them.
- **Every claim carries its evidence or its source**: a symbol, a commit, an issue's call with its
  date, or `(maintainer, <date>)` for what nothing in the repo can show.
- **The checker**: `python .github/scripts/check_map.py` (CI runs it, with `--selftest`), configured
  by `.checkup.json` — links, anchors, `## Code` symbols, section sets, invariant reciprocity and
  note paths cited from source comments.

## What this map cannot answer

- **Only `.md` files are nodes.** Source files, issues and PenTerm's documents are text inside
  notes.
- **Consumer behaviour.** What PenTerm does with a row, a key or a press is PenTerm's; a note here
  says where the engine stops, not what happens after.
- **A designed-but-unbuilt territory has no blast radius** and would be reachable only from here.
  There is none today.

## Coverage

**Complete for `src/` and the package's build and publish surface as of `f0b2175`.** Every file
under `src/` is named under some note's `## Code`. The territories:
[column model](territory/column-model.md) · [column move](territory/column-move.md) ·
[row windowing](territory/row-windowing.md) ·
[grid scaffold](territory/grid-scaffold.md) · [header lane](territory/header-lane.md) ·
[header row](territory/header-row.md) · [column resize](territory/column-resize.md) ·
[drag lifetime](territory/drag-lifetime.md) ·
[auto-fit](territory/auto-fit.md) · [table row](territory/table-row.md) ·
[keyboard movement](territory/keyboard-movement.md) · [marquee](territory/marquee.md) ·
[colour variables](territory/colour-variables.md) ·
[stylesheet and prefix](territory/stylesheet-and-prefix.md) ·
[package and release](territory/package-and-release.md) ·
[verification gates](territory/verification-gates.md).

The invariants: [drawn columns are tracks are cells](invariant/drawn-columns-are-tracks-are-cells.md) ·
[zero is no measurement](invariant/zero-is-no-measurement.md) ·
[lengths are layout px](invariant/lengths-are-layout-px.md) ·
[row one is the header](invariant/row-one-is-the-header.md) ·
[mechanism here, policy in the consumer](invariant/mechanism-here-policy-in-the-consumer.md).

**Out of scope, with the reason**: `logo/` (brand artwork, shipped by no export and read by no
code; the README links its PNGs by URL), `dist/` and `node_modules/` (ignored build output and
dependencies), `docs/agents/` (configuration for the agent skills, not the system), and
`.out-of-scope/` (decision records — cited as sources by the notes they govern).

**What an absent note means.** A new file under `src/` either belongs to a territory above — add it
to that note's `## Code` — or it is a new thing the table does, and then a note is owed in the same
change, written from the code as it then stands. There is no correct state in which a file under
`src/` is named by no note. `example/` belongs to [verification gates](territory/verification-gates.md).
Outside `src/`, a new published surface (an export path, a second stylesheet, a CI workflow) is owed
to [package and release](territory/package-and-release.md) or
[verification gates](territory/verification-gates.md). A territory appears when something in the repo
commits to it — an open issue with a design, a decision recorded in a note.

**The weakest node** is [row one is the header](invariant/row-one-is-the-header.md): its sites are
real and do not call each other, but its discovery history is empty. If it never gains one, it
belongs back in [grid scaffold](territory/grid-scaffold.md)'s design model.
