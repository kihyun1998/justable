# Auto-fit

## What it is

Sizing columns to their widest content: `useColumnAutoFit`'s `measure(key)` — on a handle's
double-click — mounts a `TableRuler` for that one column, reads the width of every ruler cell,
unmounts it, and returns the widest, all inside the calling event. `measureAll(keys)` — on whatever
the consumer wires to it — does the same for several columns from one mount of the ruler (#14).

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
  `w-max`. A group is found back among the ruler root's children by comparing its
  `data-table-ruler` to the key — never through a CSS selector, which a key holding `"` or `]` broke:
  `querySelector` threw, and with no `finally` the ruler stayed mounted with `measuring` stuck. Both
  calls now unmount in a `finally`, so a read that throws still leaves nothing mounted.
- **Nothing measured is `null`, never zero.** A ruler with no cells, or cells with no width, answers
  `null`; a real answer is the widest cell rounded **up**. See
  [zero is no measurement](../invariant/zero-is-no-measurement.md).
- **Many columns, one mount.** `measureAll(keys)` sets `measuring` to the whole list, so the ruler
  draws one `data-table-ruler` group per key under one root, and every group is read after the one
  commit: two `flushSync`s whatever the column count, where a `measure` per column costs two each and
  a full-row render each. The groups are blocks stacked in the ruler and every cell is `w-max`, so a
  group's widths do not depend on its neighbours — each key answers what `measure(key)` answers. Only
  `check:example` can pin that, since jsdom lays nothing out: it double-clicks every border after
  fit all and requires no width to move. Every distinct key asked about is in the answer, `null`
  included — the return type is `Record` over the keys passed — and a key asked about twice is drawn
  and measured once, since two groups under one React key collide; an empty list mounts nothing and
  answers `{}`.
- **`measuring` is `K | readonly K[] | null`**, and `TableRuler`'s `column` takes either, so the
  consumer's `column={measuring}` wiring serves both calls unchanged. A consumer that read
  `measuring` as a `K` has to narrow it now. That makes the widening breaking under the CHANGELOG's
  own rule, so the release that carries it is **0.2.0**, and its CHANGELOG entry is written at that
  release, as every other entry was, not ahead of it — both the maintainer's calls, 2026-09-29
  (#14), made knowing PenTerm uses `measuring` only as `!== null` and `column={measuring}` (read,
  not compiled). Theirs to reverse.
- **The answer is unclamped.** The consumer puts it through the model's `withWidth`.
- **The wiring is the consumer's.** The hook returns `measuring` (the key, the keys, or `null`) and `rulerRef`;
  the consumer renders `<TableRuler ref={rulerRef} column={measuring} …>` while `measuring` is set and
  calls `measure` from `onAutoFit`. Which columns `measureAll` fits, and what triggers it, are the
  consumer's too; the example folds `withWidth` over the non-null answers in one `setLayout`.

## Code

- `src/hooks/useColumnAutoFit.ts` — `useColumnAutoFit`
- `src/components/TableRuler.tsx` — `TableRuler`, `TableRulerProps`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — `measure` and each key of
  `measureAll` answer `null` for a ruler group that measured nothing.
- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  the renderer, the classes and the clamp are the consumer's.

## Blast radius

- [Table row](table-row.md) — the ruler must draw what the row's cell draws; a change to the cell's
  padding or wrapper there that the ruler does not share makes every fit wrong.
- [Header row](header-row.md) — the double-click on the handle is the entry to `measure`;
  `measureAll` has no entry here, the consumer triggers it.
- [Column model](column-model.md) — clamps the answer.
- [Stylesheet and prefix](stylesheet-and-prefix.md) — `TABLE_CELL` is shared with the row.

## Known holes / open

- **Real widths are verified only in a browser** — PenTerm's checks and `check:example` here, which
  checks that fit all moves the columns and that a double-click on any border afterwards changes no
  width. See [verification gates](verification-gates.md). The jsdom tests here check the ruler's shape
  and, with `getBoundingClientRect` stubbed, what `measure` and `measureAll` do with the widths read.
- **Cost grows with the row count.** Every row is rendered for one measurement; nothing here caps it.
  `measureAll` renders rows × columns cells in its one mount. Measured 2026-09-29 in the example
  (5,001 rows × 4 columns, React's development build as `pnpm example` serves it, Chrome headless,
  median of 7): fit all 549 ms, a double-click on each of the 4 borders 848 ms in total. The one
  mount saves the commits, not the cells — drawing 20,000 cells is most of either figure. Across
  the 7 runs both climbed (the four double-clicks from 340 to 1,473 ms), unexplained and not
  specific to `measureAll`.
