# Keyboard movement

## What it is

Where a key sends the keyboard's row: arrow, page and end keys, and type-ahead by name. The rules are
pure functions in `tableKeyboard.ts`; `useTypeAhead` holds the type-ahead query and its clock;
`useTableKeyboard`, built on it, claims the event when it moves the row, and exposes a `link` the grid writes its page size into. The
consumer calls `step` from wherever it receives keys and decides what a move means.

## Governing decisions

- **A fresh letter searches after the focused row, wrapping, with that row checked last** — the
  maintainer's call, 2026-09-30, #20, over documenting the old behaviour (a fresh letter searched from
  the row itself, so a focused row that matched kept focus, while README § Keyboard said "the next
  row"). The call did not cover narrowing, the walk, or `TYPE_AHEAD_MS` (#27); narrowing staying
  unchanged is a second call of the same day. Theirs to reverse.
- **Earlier calls are recorded where they were written, in `## Design model`**: #1 (a movement key
  ends the query; Shift+Space inside a running query extends it) and #5 (a miss ends the query;
  type-ahead is its own hook).

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **A hook the consumer calls, not a key handler on the grid.** PenTerm's Explorer receives keys on
  its pane, which holds focus whenever the grid does not; a handler on the grid would leave arrows dead
  there (`penterm 7032eb5d0`). The grid writes `rowsPerPage` into the hook's `link`, so the consumer
  never holds that number; `link` is one object for the hook's life so the grid can keep it.
- **The answer is where the row goes; what that selects or opens is the consumer's.** `step` returns
  `{ by: 'move', to }`, `{ by: 'typeAhead', to }`, or `null` for a key that is not the table's.
- **Movement**: ↑/↓ one row, PageUp/PageDown a page, Home/End the ends. The first ↑, ↓, PageUp or
  PageDown into an unwalked list (`focus === null`) lands on row 0 rather than nowhere. A page is at
  least one row, because the viewport measures 0 before layout (`FALLBACK_PAGE`). Modifiers do not
  stop a movement key — what Shift or Ctrl adds is the consumer's.
- **Movement clamps at the ends and never wraps**, unlike type-ahead's search: a held key at the
  bottom would silently return to the top and carry an extending selection with it. An empty list
  answers `null` for every key — the container is focusable, and keys arrive before anything has
  loaded.
- **←/→ do nothing, out loud.** `grid`'s APG pattern is cell-first, but no cell here is actionable on
  its own; `grid` was chosen only because `aria-sort` exists nowhere else
  ([grid scaffold](grid-scaffold.md)), and declining the arrows is the bill that choice left.
  `nextFocusIndex` answers `null` for both, with a test naming why.
- **An event is claimed only when the row moves** (`preventDefault`). A type-ahead key that matches
  nothing is answered `to: null` — distinct from a key never the table's — and its event is left
  alone.
- **Type-ahead is one printable character with no Ctrl, Meta or Alt**, so chords are never eaten
  (Shift is allowed; named keys are all longer than one character).
- **A space extends a running query and is otherwise the consumer's.** A query is running while it
  is non-empty and its last character arrived within `TYPE_AHEAD_MS` — one definition, `running`,
  which also decides whether a letter starts a fresh query. A lone Space is the keyboard's click in a
  list: taken by type-ahead, plain and Shift+Space reached nothing (`penterm ccd3eee0c`). Refusing
  every space instead made a name with one inside it (`new folder`) unreachable by typing, and sent
  the mid-name space to the consumer as a click (#1). "Non-empty" matters because the stored time
  starts at 0: on a clock near 0, a first key would otherwise read as inside the window.
- **A movement key ends the query** — the maintainer's call, 2026-09-28, #1. Found while checking the
  space rule: with a move leaving the query running, `n` ↓ Space inside 700 ms extended the query to
  "n " instead of reaching the consumer, so a row that selected before the change did not. Shown:
  a move ends the query (Space after a move is always the consumer's; a letter after a move starts
  fresh, so `c` ↓ `h` searches "h", not "ch") against exempting only the space (letters keep
  narrowing across a move, at the cost of two definitions of "running") and against leaving the
  narrow regression recorded. Chose the first. Theirs to reverse.
- **Shift+Space inside a running query extends it too** — the maintainer's call, 2026-09-28, #1.
  Shown: extend (a space typed with Shift held mid-name, the same rule as a letter) against leaving
  it to the consumer (range selection always available, but a shifted space never in a name); the
  cost named was that a Shift+Space within 700 ms of typing no longer extends a selection. Theirs to
  reverse.
- **The query**: a pause over `TYPE_AHEAD_MS` (700) starts a fresh one, which searches **after** the
  focused row, from the top when there is none (#20). The same letter again **walks** to the next
  match, searching after the current row too, rather than asking for "cc" — but only while the whole
  query is that one letter: once it is longer the user is spelling, and `cr` + `r` looks for "crr".
  The walk compares ignoring case, as matching does, so `c` then `C` walks too. Another letter
  **narrows**, searching from the current row itself: in `apple, cherry, citrus` with nothing
  focused, `c` lands on `cherry` and `h` keeps it there; from `cherry`, `c` lands on `citrus` and `h`
  wraps back to `cherry`. `typeAheadStep`'s `after` says which of the two searches a key makes.
  Matching is a case-insensitive prefix over `names`, which must be in screen order or the hit lands
  on the wrong row.
- **"After the row" checks that row last.** `typeAheadIndex` starts at the row after `from` and wraps
  all the way round, so the focused row is the last candidate rather than excluded: a letter only it
  matches lands on it, and that is a hit — the event is claimed — not a miss.
- **One rule for a query that did not walk**: it lands on the first match of the whole query after
  the row where it started, wrapping, with that row checked last. Narrowing from the row the first
  letter landed on is what makes that hold: in `cherry, chive, citrus` from `cherry`, `c` `h` `e`
  lands on `chive`, `chive`, `cherry`. **A query that walked is outside it**, and #20's call did not
  cover it: narrowing starts from the row the walk reached, so in `cherry, citrus, chive` with
  nothing focused `c` `c` `h` lands on `cherry`, `citrus`, `chive` — not on `cherry`, the first "ch"
  from the top. Measured with `useTypeAhead`, 2026-09-30.
- **A miss ends the query** — the maintainer's call, 2026-09-28, #5. Keeping it meant one typo
  left type-ahead matching nothing until a pause, since the query only grows. Shown beside
  react-aria's `useTypeSelect`, which clears on a miss. The event of a miss is still left alone.
- **Type-ahead is its own hook, `useTypeAhead`** — the maintainer's call, 2026-09-28, #5, over a
  pure reducer and over leaving it as exported pieces. The rules now depend on other keys (a move
  ends the query, a space only extends a running one), and pieces cannot carry that: PenTerm's folder
  sidebar had copied them and missed both rules from #1. `useTableKeyboard` is built on it and calls
  `end()` on its own moves; **a list with movement of its own must call `end()` itself**, because
  the hook cannot see that list's moves. react-aria also keeps type-ahead as a separate hook reused
  across collections, and keeps it off its public surface; here it is public because a consumer's
  tree needs it. The pure pieces (`typeAheadStep`, `typeAheadIndex`, `nextFocusIndex`) are internal.
- **The clock is injectable** (`now`), which is how the tests cross the 700 ms window.

## Code

- `src/hooks/useTypeAhead.ts` — `useTypeAhead`, `TypeAheadAnswer`
- `src/lib/tableKeyboard.ts` — `nextFocusIndex`, `typeAheadIndex`, `typeAheadStep`, `TYPE_AHEAD_MS`, `FALLBACK_PAGE`, `FocusMoveInput`, `TypeAheadStep`, `TableKeyEvent`
- `src/hooks/useTableKeyboard.ts` — `useTableKeyboard`, `TableKeyboardLink`, `TableKeyStep`

## Reference behaviour

- react-aria `useTypeSelect`, read as source at react-spectrum `16eead67e8`,
  `packages/react-aria/src/selection/useTypeSelect.ts`, for #5: a separate hook reused by list,
  grid and tree; a space extends a running search (as here); a miss clears the search (now as here);
  no walk on a repeated letter and a 1000 ms window (both differ here, by the rules above); a move
  does not end the search (differs, by #1's call). Its search, `ListKeyboardDelegate.getKeyForSearch`
  at the same commit, starts **at** the focused key, inclusive, and `useTypeSelect` retries it from
  the first key on a miss: every letter, fresh or narrowing, searches from the focused row itself.
  Narrowing is as here; a fresh letter keeps a focused row that matches, which differs since #20.
- The W3C APG listbox example, read as source at w3c/aria-practices `3f094fd`,
  `content/patterns/listbox/examples/js/listbox.js`, `findItemToFocus`, for #20. A fresh letter
  searches after the focused item and wraps, as here. Where a search starts differs in three
  details: the wrap stops short of
  the focused item (`findMatchInRange(list, 0, searchIndex)` is exclusive), so a letter only it
  matches finds nothing, where here it lands on it; with nothing focused `searchIndex` stays 0, so a
  fresh letter searches from index 1 and item 0 is never a match, where here it searches from the
  top; and an extended query does the same from index 1, where here narrowing searches from the
  current row. Its query differs too: every letter is appended (`keysSoFar += character`), so a
  repeated letter does not walk, and only a 500 ms timer clears it — not a miss, not a move.

**None.** otherwise in this repository. The W3C APG grid pattern is what the ←/→ refusal is measured against;
PenTerm's `explorer-block.md` § Reference behavior records that reading. Windows Explorer is said
to walk repeated letters the same way (carried from a test comment); no source is pinned, so that is
unchecked.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `rowsPerPage` 0 is read as
  "unmeasured" and pages by `FALLBACK_PAGE`.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the hook answers where; selection, opening, a lone Space and every modifier's meaning are the consumer's.

## Blast radius

- [Grid scaffold](grid-scaffold.md) — the consumer feeds the answer back as the grid's `focus`,
  which drives `aria-activedescendant`.
- [Row windowing](row-windowing.md) — writes `rowsPerPage`, and reveals the row a move lands on.

## Known holes / open

- **A `focus` outside `names` has no contract, and a negative one throws** (#30). Narrowing passes
  `focus - 1`, so `focus = -1` reaches `names[-1]`; an index past the end wraps by modulo. Measured
  with `typeAheadIndex`, 2026-09-30. No consumer here reaches it.
