# Mechanism here, policy in the consumer

## The fact

The engine answers **how** — where a key moves the row, what width a drag reports, which rows are
drawn, which colour role paints what — and never **what it means** or **which one**: what a move
selects, which press may start a resize, what the colours are, what a column's bounds and order are,
what a label says. Every such choice arrives as a prop, a spec entry, a class or a bound variable,
and the engine holds **no default** for it.

Checkable: the engine imports nothing but itself, React, React DOM and the icon set (the lint); a
prop carrying a consumer's choice is either required (`refusePress`, `label`, `resizeLabel`) or, when
optional, absent means the engine does nothing (`onAutoFit`, `onFloorClick`, `cellClassName`). The
defaults that do exist (`scale = 1`, `disabled = false`, `showRows = true`) are identities, not
choices.

## Why it is cross-cutting

Each territory has its own seam, and they look nothing alike — a required predicate, a returned
answer instead of a handler, a spec field, a CSS variable, a consumer class. They share no code. What
they share is the rule that the seam carries no default, because a default is a second copy of a
consumer's policy that the consumer cannot see.

## Territories it holds in

- [Column resize](../territory/column-resize.md) — `refusePress` is required; the engine has no
  button rule. The width is reported unclamped.
- [Keyboard movement](../territory/keyboard-movement.md) — `step` answers where and claims the event;
  selection, opening and Space are the consumer's.
- [Column model](../territory/column-model.md) — bounds, first sort direction, comparator and
  hideability are the spec's.
- [Colour variables](../territory/colour-variables.md) — roles, not colours; no fallback.
- [Header row](../territory/header-row.md) — labels, the handles' accessible name, what a sort press
  does, height and type.
- [Table row](../territory/table-row.md) — row colours and every row handler.
- [Auto-fit](../territory/auto-fit.md) — the renderer, the classes, and the clamp.
- [Grid scaffold](../territory/grid-scaffold.md) — the label, the floor click, the scroller wrapper.
- [Verification gates](../territory/verification-gates.md) — the import rule is the mechanical half.

## What a violation looks like

A consumer rule reappearing inside the engine as a default or a hard-coded case. It passes every
test in the engine and breaks the consumer's own rule silently, because the consumer's rule now has
two copies and only one is theirs.

## Discovery history

In PenTerm, as the engine was separated from the app:

- `penterm 3a7dae00e` (2026-09-28) — the header took a required `refusePress` instead of a button
  rule; a default would have been a second button comparison, which PenTerm's
  `drag-guard-goes-through-the-predicate` lint refuses.
- `penterm 7032eb5d0` (2026-09-28) — keyboard movement became the engine's and what a move selects
  stayed the Explorer's; a key handler on the grid would have left the pane's arrows dead.
- `penterm ccd3eee0c` (2026-09-28) — type-ahead had taken Space, a consumer's key, and plain and
  Shift+Space stopped selecting; Space was handed back.

The third is the rule broken and found: the engine had quietly decided a key that was the
consumer's.

## Where it will recur

**If a new prop, key or gesture has an obvious "usual" answer**, that answer is policy. Ask whether
any consumer could want another one; if so, it is a required prop or an answer returned to the
consumer, not a default here.
