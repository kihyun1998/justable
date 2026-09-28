# MAP — justable

<!-- grill-map build stamp: df3ec77 -->

The layer that answers the two questions no other artifact here can, because every other artifact is
indexed by an event — a commit, an issue — and none is indexed by what the package does.

| Question | Open |
|---|---|
| **If I touch this, what else moves?** | the territory note for what you are touching, then its `## Blast radius` — read it as a **checklist**. Opening a listed territory and finding nothing to do is a correct outcome; not opening it is the failure this layer exists to prevent. Then its `## Cross-cutting invariants`, the same way |
| **What is this derived from?** | the same note's `## Governing decisions` (who decided) and `## Reference behaviour` (what it was checked against). A `**None.**` there is the answer, not an omission |

Written in English, as the README and `CLAUDE.md` are: an agent reads this at the start of a task.

## The failure that justifies this layer

The engine was moved out of PenTerm in one commit (`6236425`), and its reasoning did not come with
it. Two source comments arrived citing map notes by path — `rowWindow.ts` named `table.md`,
`tableKeyboard.ts` named `table-engine.md` — and neither existed in this repository; the second was
PenTerm's, and the first was never a file in either repository — the path was wrong from the commit
that wrote it (`penterm 1b3bc40a3`). Both now name the notes here. Every
measurement that fixes a constant here (`BLOCK_ROWS`, `UNMEASURED_ROWS`, the `right: 0` on a placed
row, the lane's `clip`) lived in a consumer's repository, where the next person to change the engine
would not look.

That is the young-repo form of the rediscovery this layer prevents: not a fact found twice yet, but
a fact whose only record sits where it will not be found the first time.

## PenTerm provenance

Most `## Design model` content here was led by PenTerm's note on this engine and then **checked
against this repository's code** before it was written; a line the code did not bear out was left out
or corrected (one example: PenTerm's note says the test suites always see the unmeasured grid, and
`TableGrid.test.tsx` here stubs `clientHeight` to reach the measured one).

- **The lead**: PenTerm `docs/map/territory/table-engine.md` at PenTerm commit `73fad8b77`
  (the note last changed in `0fab5f2f9`). PenTerm does not resolve as `kihyun1998/penterm` on
  GitHub, so this is cited as text and cannot be a link.
- **"(PenTerm)" after a number** means it was measured in PenTerm's app, in PenTerm's scopes, and has
  not been re-measured here. It is evidence for the rule, not a property of this package's tests.
- **`penterm <sha>`** is a commit in that repository.
- PenTerm's note keeps its consumer side — its `--table-*` binding, how it installs this package, its
  own checks. What that note still says about the engine itself is now a second copy; reducing it to
  a pointer here is PenTerm's change to make, not this map's.

## Measured

Commands, not numbers: a number stored here competes with the tree that produces it.

```sh
rg -c '^export|^  [A-Za-z]' src/index.ts          # M1 — the public surface, by export line
ls docs/adr 2>/dev/null | wc -l                     # M1 — records governing it (none: no docs/adr/)
wc -l src/components/*.tsx | sort -rn              # M3 — where the component layer's mass sits
rg -n 'docs/map/[A-Za-z/.-]+\.md' src              # M4 — source comments citing a note by path
gh issue list --state open                         # M5 — the open backlog
```

What they showed on the day this was written, and what does not rot with the numbers:

- **M1 — every public promise is ungoverned.** The package has no `docs/adr/` and no `CONTEXT.md`.
  The only records that decided anything about it — PenTerm's ADR-0099 and ADR-0100, on column
  resize — are in the consumer's repository, and nothing here adopts them. So every
  `## Governing decisions` in this map is `**None.**`, and the adjacent PenTerm records are named where
  they apply.
- **M3 — `TableGrid.tsx` is about half of the component layer**, and it is three territories that
  share one function: [grid scaffold](territory/grid-scaffold.md),
  [row windowing](territory/row-windowing.md) and [header lane](territory/header-lane.md). The
  function they share is `measureBox`.
- **M4 — the stale pointers were in source, not prose**: the two comment paths above, and test
  headers citing PenTerm's files by path. The one stale prediction was the lint's alias for PenTerm's
  tree ("while it still lives in PenTerm's tree"), which stayed after the move and permitted an import
  that could never build here. The worst find was a figure rather than a pointer — see
  [row windowing](territory/row-windowing.md#known-holes--open).
- **M5 — nothing is open**, and nothing records deliberate absence except PenTerm's note's
  `## Known holes / open`, whose engine-side entries are carried into the notes here as
  observations.

## How this is read and written

- **Read** — before designing a change: this hub, then the territory for what you are touching,
  then its blast radius and invariants as a checklist.
- **Write** — `CLAUDE.md` § Comments already sends a comment's why, trap and measured value here; a
  change that alters a rule updates the note in the same change.
- **Promotion** — at the first fix, ask whether the fact holds at another site that shares the
  same assumption. Here the shared assumptions are few and nameable: *does this code read a length
  from layout? does it number rows or columns? does it choose what a gesture or key means?* If yes,
  the fact goes in an invariant note before the fix lands.

## Conventions

- **Empty sections stay**, and `**None.**` is the sentinel. It marks three different holes — nobody
  decided, nobody checked against a reference, nobody built it — so every query for it names its
  heading:

  ```sh
  rg -lU '## Governing decisions\r?\n\r?\n\*\*None\.\*\*' docs/map/territory/
  rg -lU '## Reference behaviour\r?\n\r?\n\*\*None\.\*\*' docs/map/territory/
  ls docs/map/territory/ docs/map/invariant/        # what exists; the folder is the roster
  ```

- **Territories overlap.** A fact that holds in several is an invariant note, not a copy.
- **Symbols, never line numbers.**
- **Plain relative markdown links**, not `[[wikilinks]]`.
- **One owner per list.** The `--table-*` roster is owned by `README.md` § Colours (published); the
  export list by `src/index.ts`. Notes point at them.

## What this map cannot answer

- **Only `.md` files are nodes.** Source files, issues and PenTerm's documents are text inside
  notes.
- **Consumer behaviour.** What PenTerm does with a row, a key or a press is PenTerm's; a note here
  says where the engine stops, not what happens after.
- **A designed-but-unbuilt territory has no blast radius** and would be reachable only from here.
  There is none today.

## Coverage

**Complete for `src/` and the package's build and publish surface as of `6236425`.** Every file
under `src/` is named under some note's `## Code`. The territories:
[column model](territory/column-model.md) · [row windowing](territory/row-windowing.md) ·
[grid scaffold](territory/grid-scaffold.md) · [header lane](territory/header-lane.md) ·
[header row](territory/header-row.md) · [column resize](territory/column-resize.md) ·
[auto-fit](territory/auto-fit.md) · [table row](territory/table-row.md) ·
[keyboard movement](territory/keyboard-movement.md) ·
[colour variables](territory/colour-variables.md) ·
[stylesheet and prefix](territory/stylesheet-and-prefix.md) ·
[package and release](territory/package-and-release.md) ·
[verification gates](territory/verification-gates.md).
The invariants: [drawn columns are tracks are cells](invariant/drawn-columns-are-tracks-are-cells.md) ·
[zero is no measurement](invariant/zero-is-no-measurement.md) ·
[row one is the header](invariant/row-one-is-the-header.md) ·
[mechanism here, policy in the consumer](invariant/mechanism-here-policy-in-the-consumer.md).

**What an absent note means.** A new file under `src/` either belongs to a territory above — add it
to that note's `## Code` — or it is a new thing the table does, and then a note is owed in the same
change, written from the code as it then stands. There is no correct state in which a file under
`src/` is named by no note. Outside `src/`, a new published surface (an export path, a second
stylesheet, a CI workflow) is owed to [package and release](territory/package-and-release.md) or
[verification gates](territory/verification-gates.md).

**The weakest node** is [row one is the header](invariant/row-one-is-the-header.md): its sites are
real and do not call each other, but its discovery history is empty. If it never gains one, it
belongs back in [grid scaffold](territory/grid-scaffold.md)'s design model.
