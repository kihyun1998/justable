# A focusable resize handle

The column resize handle stays a pointer-only separator. It takes no focus, carries no
`aria-valuenow`, `aria-valuemin` or `aria-valuemax`, and answers no key. Making it a focusable
splitter, either always or behind an opt-in prop, is out of scope.

A column can still be resized from the keyboard. `TableHeader`'s `onColumnKeyDown(key, event)` reports
a key pressed on a column's sort button, and `withWidth` clamps a width to the column's bounds, so a
consumer binds whatever key and step it wants:

```tsx
onColumnKeyDown={(key, e) => {
  const step = e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0;
  if (!e.altKey || step === 0) return;
  e.preventDefault();
  setLayout(model.withWidth(layout, key, model.columnWidth(layout, key) + step));
}}
```

Checked in jsdom at triage (#67): three Alt+→ took a column from 100 px to 120, its `maxWidth`, and
ten Alt+← took it to 50, its `minWidth`, with the grid template following.

## Why this is out of scope

The W3C ARIA APG's window splitter pattern says a splitter is focusable and moves with the arrow
keys. The handle claims `role="separator"` without honouring that pattern, and that is deliberate.

- **The only consumer decided against it.** PenTerm's ADR-0099, "A resize boundary is not
  keyboard-operable" (accepted 2026-09-16), lists this column border among its five resize
  boundaries and keeps all of them pointer-only. Its main reason is the Tab order: a focusable
  handle is one more stop per column, on a surface a keyboard user crosses constantly. That is a
  call about a whole app's keyboard model, not about one boundary. An engine that made the handle
  focusable by default would overturn it from below.
- **Nothing is unreachable without it.** The keyboard path above changes a width without a
  pointer. It reuses the column's existing Tab stop, the sort button, and the mechanism #63 added
  for moving a column. The key stays the consumer's, as
  [mechanism here, policy in the consumer](../docs/map/invariant/mechanism-here-policy-in-the-consumer.md)
  asks.
- **An opt-in focusable handle** was weighed and set aside. It would add a prop, a focus ring that
  has to read as a boundary rather than a control, and the value attributes, all for a path that
  already exists.

## What this does not cover

- **A screen reader cannot read a column's width.** The separator carries no value, and the sort
  button's name is the label alone. A consumer that needs the width announced is the case that
  could reopen this, together with any consumer that wants the handle itself to be operable.
- **Escape during a drag** is a separate matter (PenTerm's ADR-0100), still open in
  `docs/map/territory/column-resize.md`.

## Prior requests

- #67: "A column cannot be resized from the keyboard: the resize handle is not focusable and has no value"
