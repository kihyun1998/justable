# Keyboard movement

## What it is

Where a key sends the keyboard's row: arrow, page and end keys, and type-ahead by name. The rules are
pure functions in `tableKeyboard.ts`; `useTableKeyboard` holds the type-ahead query and its clock,
claims the event when it moves the row, and exposes a `link` the grid writes its page size into. The
consumer calls `step` from wherever it receives keys and decides what a move means.

## Governing decisions

**None.**

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
  (Shift is allowed; named keys are all longer than one character). **Never a space**: a space is the
  keyboard's click in a list and is left to the consumer — taken by type-ahead, plain and Shift+Space
  reached nothing (`penterm ccd3eee0c`).
- **The query**: a pause over `TYPE_AHEAD_MS` (700) starts a fresh one; the same letter again
  **walks** to the next match, searching after the current row, rather than asking for "cc" — but only
  while the whole query is that one letter: once it is longer the user is spelling, and `cr` + `r`
  looks for "crr". Another
  letter **narrows**, searching from the current row itself, so `c` then `h` stays on `cherry`.
  Matching is a case-insensitive prefix over `names`, which must be in screen order or the hit lands
  on the wrong row.
- **The clock is injectable** (`now`), which is how the tests cross the 700 ms window.

## Code

- `src/lib/tableKeyboard.ts` — `nextFocusIndex`, `typeAheadIndex`, `typeAheadStep`, `TYPE_AHEAD_MS`, `FALLBACK_PAGE`, `FocusMoveInput`, `TypeAheadStep`
- `src/hooks/useTableKeyboard.ts` — `useTableKeyboard`, `TableKeyboardLink`, `TableKeyEvent`, `TableKeyStep`

## Reference behaviour

**None.** in this repository. The W3C APG grid pattern is what the ←/→ refusal is measured against;
PenTerm's `explorer-block.md` § Reference behavior records that reading. Windows Explorer is said
to walk repeated letters the same way (carried from a test comment); no source is pinned, so that is
unchecked.

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `rowsPerPage` 0 is read as
  "unmeasured" and pages by `FALLBACK_PAGE`.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the hook answers where; selection, opening, Space and every modifier's meaning are the consumer's.

## Blast radius

- [Grid scaffold](grid-scaffold.md) — the consumer feeds the answer back as the grid's `focus`,
  which drives `aria-activedescendant`.
- [Row windowing](row-windowing.md) — writes `rowsPerPage`, and reveals the row a move lands on.

## Known holes / open

- **Walk detection is case-sensitive while matching is not.** `typeAheadStep` compares the previous
  query with the key exactly, so `c` then `C` extends to "cC" (matched as "cc") instead of walking.
  Whether that is intended is recorded nowhere.
