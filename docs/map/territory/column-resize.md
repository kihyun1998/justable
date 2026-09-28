# Column resize

## What it is

Dragging a column border to set that column's width: the handle each `columnheader` draws on its
right edge, the press handler that arms a drag, and `useColumnResize`, which follows the pointer on
`document` and reports the width until the button comes up.

## Governing decisions

**None.** in this repository. Adjacent, in PenTerm: ADR-0099 (a resize boundary is not
keyboard-operable) and ADR-0100 (a resize in flight is not cancelled) roster this column border among
PenTerm's resize boundaries. They decide PenTerm's policy across its boundaries; nothing here adopts
them, and the code matches both only because it implements neither a key nor Escape.

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **A border belongs to the column on its left.** Its handle straddles that column's right edge — a
  12 px target (`w-3`, `-right-1.5`) around a 1 px line. The last column has one too: the filler track
  makes its right edge a real border.
- **The line stops 0.375 rem short of both edges**, so it forms no T with the header's bottom border.
- **The line shows by colour, never width**, so nothing shifts under the pointer; it stays at its
  active colour for the whole drag, because the pointer leaves the handle as soon as it moves.
- **Mouse events on `document`, not HTML5 drag** — PenTerm's host (Tauri) swallows HTML5 drags in its
  webview. `mousedown` arms, `mousemove` reports, `mouseup` ends.
- **The press is suppressed for every button, then the consumer decides.** `preventDefault` and
  `stopPropagation` run first, so a wheel press never starts autoscroll; only then does
  `refusePress(event)` say whether this press arms a drag. **The engine holds no button rule and no
  default**, so `refusePress` is required.
- **The reported width is unclamped**, `startWidth + (clientX − startX) / scale`, where `scale` is
  screen px per table px for a scaled copy of the table. The consumer's model clamps.
- **A drag cannot outlive its component or another drag.** `begin` detaches any running drag first;
  unmounting detaches the `document` listeners, so a header gone mid-drag writes nothing more.

## Code

- `src/hooks/useColumnResize.ts` — `useColumnResize`
- `src/components/TableHeader.tsx` — `TableHeader`, `startResize`, `refusePress`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  `refusePress` is this territory's policy seam, and the clamp is the model's.

## Blast radius

- [Header row](header-row.md) — draws the handle and its line; the line's colour follows
  `resizing`.
- [Column model](column-model.md) — `withWidth` clamps what this reports.
- [Auto-fit](auto-fit.md) — the same handle's double-click; a change to the handle's hit area moves
  both gestures.

## Known holes / open

- **Mouse only.** No touch or pen drag: the handlers are `mousedown`/`mousemove`/`mouseup`, and
  touch input produces no compatible `mousemove` stream. Whether that is policy or omission is
  recorded nowhere here (PenTerm is a desktop app).
- **Not keyboard-operable, and Escape does nothing mid-drag.** Decided for PenTerm by its ADR-0099
  and ADR-0100; undecided for any other consumer.
- **`useColumnResize`'s header comment says "Pointer events"** while the code uses mouse events —
  it means pointer-driven, not the Pointer Events API.
