# Keyboard movement

## What it is

Where a key sends the keyboard's row: arrow, page and end keys, and type-ahead by name. The rules are
pure functions in `tableKeyboard.ts`; `useTypeAhead` holds the type-ahead query and its clock;
`useTableKeyboard`, built on it, claims the event when it moves the row, and exposes a `link` the grid writes its page size into. The
consumer calls `step` from wherever it receives keys and decides what a move means, and `end` when it
moves the row by other means.

## Governing decisions

- **A fresh letter searches after the focused row, wrapping, with that row checked last** — the
  maintainer's call, 2026-09-30, #20, over documenting the old behaviour (a fresh letter searched from
  the row itself, so a focused row that matched kept focus, while README § Keyboard said "the next
  row"). The call did not cover narrowing, the walk, or the window (#27); narrowing staying
  unchanged is a second call of the same day. Theirs to reverse.
- **The type-ahead window is the consumer's, and required** — the maintainer's call in triage,
  2026-09-30, #27, over recording 700 ms as the engine's mechanism and over an optional window
  defaulting to 700. Shown: #9's required marquee `threshold`, also a tolerance on human input;
  [mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md),
  which allows only an identity default, and 700 is none; and the references disagreeing (500 and
  1000 ms, below). The brief also said PenTerm's earlier type-ahead used 1000 ms; PenTerm's history
  does not bear that out — its type-ahead has used 700 since it was written (`penterm e99f7e6ff`,
  2026-08-26), and 700 is what came here. Both hooks take `windowMs` and the engine holds no value;
  the example passes 700, the old fixed value. Shown the correction on 2026-10-01, the maintainer
  kept the call on the other reasons. It did not cover what a window not above 0 does — that is a
  derivation, under `## Design model` — nor whether `TypeAheadOptions` is exported, a second call
  of 2026-10-01: exported, as `MarqueeOptions` is. Theirs to reverse.
- **A `focus` that names no row is searched as `null` by type-ahead; a movement key clamps an
  out-of-range integer and moves from a non-integer as from `null`** — the maintainer's calls in
  triage, 2026-09-30, #30, over leaving `focus` the consumer's to keep valid and only saying so in
  the README. Three calls: type-ahead treats a `focus` naming no row as `null`, on both hooks;
  movement keeps clamping an out-of-range integer, as it already did; a non-integer moves as `null`.
  The third was triage's reading of "treat it like out of range" for movement, where clamping
  leaves `1.5` fractional; shown again on 2026-10-01 with rounding named as the alternative, the
  maintainer kept it. The calls did not cover what the grid does with a `focus` outside its rows
  (its reveal and `aria-activedescendant`, [grid scaffold](grid-scaffold.md)), nor what a consumer
  does with a stale `focus`. Theirs to reverse.
- **`useTableKeyboard` returns `end`, and `end` is one function for the hook's life on both
  hooks** — the maintainer's call, 2026-10-06, #55. Shown: returning `end` as the issue proposed,
  with or without fixing its identity, and with or without the example calling it on a click. The
  identity was not in the issue: `end` was a new closure each render, so an effect listing it as a
  dependency would run after every render — and every type-ahead hit renders, through the
  consumer's `setFocus` — ending each query after one letter. Chose both, and the example. The call
  did not cover the engine noticing a replaced list by itself (that would be policy here, against
  [mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md)),
  nor `step`'s identity, which is still new each render. Theirs to reverse.
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
  is non-empty and its last character arrived within the consumer's `windowMs` — one definition,
  `running`, which also decides whether a letter starts a fresh query. A lone Space is the
  keyboard's click in a list: taken by type-ahead, plain and Shift+Space reached nothing (`penterm
  ccd3eee0c`). Refusing every space instead made a name with one inside it (`new folder`)
  unreachable by typing, and sent the mid-name space to the consumer as a click (#1). "Non-empty"
  matters because the stored time starts at 0: on a clock near 0, a first key would otherwise read
  as inside the window.
- **A movement key ends the query** — the maintainer's call, 2026-09-28, #1. Found while checking
  the space rule: with a move leaving the query running, `n` ↓ Space inside the window extended the
  query to "n " instead of reaching the consumer, so a row that selected before the change did not.
  Shown: a move ends the query (Space after a move is always the consumer's; a letter after a move
  starts fresh, so `c` ↓ `h` searches "h", not "ch") against exempting only the space (letters keep
  narrowing across a move, at the cost of two definitions of "running") and against leaving the
  narrow regression recorded. Chose the first. Theirs to reverse.
- **Shift+Space inside a running query extends it too** — the maintainer's call, 2026-09-28, #1.
  Shown: extend (a space typed with Shift held mid-name, the same rule as a letter) against leaving
  it to the consumer (range selection always available, but a shifted space never in a name); the
  cost named was that a Shift+Space within the window of typing no longer extends a selection.
  Theirs to reverse.
- **The query**: a pause over `windowMs` starts a fresh one, which searches **after** the
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
  the hook cannot see that list's moves. The table's consumer is such a list whenever a click, a
  marquee or a replaced list moves its row, so `useTableKeyboard` returns the same instance's `end`
  (#55): measured in PenTerm's 탐색기 on 0.3.0 with `windowMs` 700, `d` into the folder `docs`,
  Enter, then `b` at once searched `db` in `a.md` … `d.md` and matched nothing; after 800 ms it
  landed on `b.md`. `end` is held in a ref, as `link` is, so its identity outlives renders. The
  example calls it on a row's click and at a marquee's end, never from `step`'s answer, which would
  end every query after one letter. react-aria also keeps type-ahead as a separate hook reused
  across collections, and keeps it off its public surface; here it is public because a consumer's
  tree needs it. The pure pieces (`typeAheadStep`, `typeAheadIndex`, `nextFocusIndex`,
  `rowOrNull`) are internal.
- **A window not above 0 keeps no query open; `Infinity` lets no pause end one.** A derivation, not
  #27's call. `running` asks `windowMs > 0` before it compares the pause, so `0`, a negative window
  and `NaN` answer alike: every letter starts a fresh query and a space is always the consumer's.
  Left to `pause <= windowMs` alone, `0` would still join two keys in the same ms, and a negative
  window would join keys whenever the clock stepped back further than it; `NaN` would fall out right
  only because every comparison with it is false. Throwing was left out: the window is read inside a
  key handler, and an invalid length elsewhere here is inert, not an error (`!(rowHeight > 0)` in
  [row windowing](row-windowing.md)). `Infinity` needs no case: every finite pause is within it, so
  a query ends only on a miss, a move or `end()`.
- **A `focus` names a row when it is an integer with `0 ≤ focus < names.length`** (#30). Every
  `to` that `step` answers is such a row or `null`. Type-ahead takes any other `focus` as `null`
  (`rowOrNull`, where `useTypeAhead.step` receives it), so a stale index searches from the top and
  never relative to a row that does not exist. Movement differs on purpose: `nextFocusIndex` counts
  from an out-of-range integer and clamps where it lands, so in four rows ↑ from `9` lands on 3
  (`clamp(8)`, not one above the last row) and ↓ from `-1` on 0 (`clamp(0)`, not one below the
  first), and takes only a non-integer as `null`, since clamping cannot make `1.5` a row. #30's
  brief worded the clamp as "as if from the nearest end"; its pinned values (↑ from `9` → 3) are the
  count-then-clamp ones, and that is what the code did before #30 and still does.
  So `useTableKeyboard` hands the same `focus` to both paths and each applies its own rule.
- **The check sits on `focus`, not on the search's `from`.** `typeAheadIndex` takes a `from` of
  `-1` on purpose: narrowing searches from the row itself by passing `focus − 1`, which is `-1` from
  row 0. A rule rejecting every negative `from` would break that. Before #30, a `focus` of `-1`
  became a `from` of `-2` on narrowing, and `%` keeps a negative operand's sign, so
  `names[-1].toLowerCase()` threw; a fractional `focus` read `names[1.5]`, `undefined`, and threw
  the same way; an index past the end wrapped by modulo and searched after a row that did not
  exist. Measured with `typeAheadIndex` and `useTypeAhead`, 2026-09-30 and 2026-10-01.
- **This is not a site of [zero is no measurement](../invariant/zero-is-no-measurement.md).** That
  fact is about a length read from layout; `focus` is an index the consumer hands in. Both read a
  value that names nothing as absent, but they share no source and no code, and the other rows of
  that note (`rowsPerPage` 0) stay where they are.
- **The clock is injectable** (`now`), which is how the tests cross the window.

## Code

- `src/hooks/useTypeAhead.ts` — `useTypeAhead`, `TypeAheadAnswer`, `TypeAheadOptions`
- `src/lib/tableKeyboard.ts` — `nextFocusIndex`, `typeAheadIndex`, `typeAheadStep`, `rowOrNull`, `FALLBACK_PAGE`, `FocusMoveInput`, `TypeAheadStep`, `TableKeyEvent`
- `src/hooks/useTableKeyboard.ts` — `useTableKeyboard`, `TableKeyboardLink`, `TableKeyStep`

## Reference behaviour

- react-aria `useTypeSelect`, read as source at react-spectrum `16eead67e8`,
  `packages/react-aria/src/selection/useTypeSelect.ts`, for #5: a separate hook reused by list,
  grid and tree; a space extends a running search (as here); a miss clears the search (now as here);
  no walk on a repeated letter (differs here, by the rules above); a move
  does not end the search (differs, by #1's call). Its search, `ListKeyboardDelegate.getKeyForSearch`
  at the same commit, starts **at** the focused key, inclusive, and `useTypeSelect` retries it from
  the first key on a miss: every letter, fresh or narrowing, searches from the focused row itself.
  Narrowing is as here; a fresh letter keeps a focused row that matches, which differs since #20.
  Its window, for #27, is `const TYPEAHEAD_DEBOUNCE_WAIT_MS = 1000`, private to the module;
  `AriaTypeSelectOptions` takes no window, so a consumer cannot change it. Here the window is the
  consumer's and required.
- The W3C APG listbox example, read as source at w3c/aria-practices `3f094fd`,
  `content/patterns/listbox/examples/js/listbox.js`, `findItemToFocus`, for #20. A fresh letter
  searches after the focused item and wraps, as here. Where a search starts differs in three
  details: the wrap stops short of the focused item (`findMatchInRange(list, 0, searchIndex)` is
  exclusive), so a letter only it matches finds nothing, where here it lands on it; with nothing
  focused `searchIndex` stays 0, so a fresh letter searches from index 1 and item 0 is never a
  match, where here it searches from the top; and an extended query does the same from index 1,
  where here narrowing searches from the current row. Its query differs too: every letter is
  appended (`keysSoFar += character`), so a repeated letter does not walk, and only a 500 ms timer
  clears it — not a miss, not a move. For #27: the 500 is a literal in `clearKeysSoFarAfterDelay`,
  and the constructor takes only the listbox node, so nothing sets it.

**None.** otherwise in this repository. The W3C APG grid pattern is what the ←/→ refusal is measured against;
PenTerm's `explorer-block.md` § Reference behavior records that reading. Windows Explorer is said
to walk repeated letters the same way (carried from a test comment); no source is pinned, so that is
unchecked.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `rowsPerPage` 0 is read as
  "unmeasured" and pages by `FALLBACK_PAGE`.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the hook answers where; selection, opening, a lone Space, every modifier's meaning and the
  type-ahead window are the consumer's.

## Blast radius

- [Grid scaffold](grid-scaffold.md) — the consumer feeds the answer back as the grid's `focus`,
  which drives `aria-activedescendant`.
- [Row windowing](row-windowing.md) — writes `rowsPerPage`, and reveals the row a move lands on.
- [Verification gates](verification-gates.md) — `check:example` types through a space, moves, and
  clicks a row between two letters, so `end()` on the example's click is held in Chrome.

## Known holes / open

**None.**
