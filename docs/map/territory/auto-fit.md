# Auto-fit

## What it is

Sizing a column to its widest content on a handle's double-click: `useColumnAutoFit` mounts a
`TableRuler` for that one column, reads the width of every ruler cell, unmounts it, and returns the
widest — all inside the calling event.

## Governing decisions

**None.**

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **It measures the real cell, not the text.** A cell is more than glyphs — icon, gap, padding — so
  `canvas.measureText` undercounts. The consumer hands the ruler the same `cell` renderer, the same
  `cellClassName` and the row's inherited type (`className`), and the ruler pads with `TABLE_CELL`,
  so the ruler cell and the real cell cannot measure apart.
- **Every row, not the window.** A fit must not depend on the scroll position.
- **The ruler exists only inside the measuring call**: `flushSync` mounts it, the cells are read,
  `flushSync` unmounts it. Kept mounted it costs a node per row and doubles every row's text for
  Testing Library's text queries, which do not skip `inert` — 80 suites failed with "Found multiple
  elements" when it was (PenTerm). So `measure` must be called from an event handler, where
  `flushSync` is allowed.
- **The ruler is invisible and inert**: `aria-hidden`, `inert`, `h-0 overflow-hidden`, cells at
  `w-max`. It is found back by `data-table-ruler="<key>"`.
- **Nothing measured is `null`, never zero.** A ruler with no cells, or cells with no width, answers
  `null`; a real answer is the widest cell rounded **up**. See
  [zero is no measurement](../invariant/zero-is-no-measurement.md).
- **The answer is unclamped.** The consumer puts it through the model's `withWidth`.
- **The wiring is the consumer's.** The hook returns `measuring` (the key, or `null`) and `rulerRef`;
  the consumer renders `<TableRuler ref={rulerRef} column={measuring} …>` while `measuring` is set and
  calls `measure` from `onAutoFit`.

## Code

- `src/hooks/useColumnAutoFit.ts` — `useColumnAutoFit`
- `src/components/TableRuler.tsx` — `TableRuler`, `TableRulerProps`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `measure` answers `null` for a
  ruler that measured nothing.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the renderer, the classes and the clamp are the consumer's.

## Blast radius

- [Table row](table-row.md) — the ruler must draw what the row's cell draws; a change to the cell's
  padding or wrapper there that the ruler does not share makes every fit wrong.
- [Header row](header-row.md) — the double-click on the handle is the only entry.
- [Column model](column-model.md) — clamps the answer.
- [Stylesheet and prefix](stylesheet-and-prefix.md) — `TABLE_CELL` is shared with the row.

## Known holes / open

- **Cost grows with the row count.** Every row is rendered for one measurement; nothing here caps it.
