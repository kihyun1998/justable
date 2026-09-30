# Lengths are layout px

## The fact

A length the engine computes with — a row height, a width, a scroll offset, a `top` — is in
**layout px**, the px a transform does not change. A length read on screen (a pointer's `clientX` /
`clientY`, a `getBoundingClientRect`) is in **screen px**, after every transform on an ancestor, and
is converted before it meets a layout length. Both are read from the browser's layout in the sense
[zero is no measurement](zero-is-no-measurement.md) uses; what differs is whether a transform has
been applied.

Checkable: every `getBoundingClientRect` and every pointer coordinate under `src/` either meets
only other screen lengths (a drag's threshold is one pointer distance against another) or passes
through a division by a scale before it meets `scrollTop`, `scrollLeft`, `clientWidth`,
`clientHeight`, `offsetHeight`, a width or a `top`. The sites below say which, and where a site does
neither.

## Why it is cross-cutting

A scaled copy of the table — a CSS `transform: scale(…)` on an ancestor, as a columns preview draws —
is invisible to every layout reading and visible to every screen reading. `clientHeight`,
`offsetHeight`, `scrollTop`, `scrollLeft` and an element's own `style` stay in layout px;
`getBoundingClientRect` and the pointer do not. The sites that mix the two are in territories that do
not call each other, and each meets the transform on its own.

**Two conventions, deliberately.** Column resize takes the scale from the consumer (`scale`, #8); the
grid works its scale out itself (#19). Unifying them was left out of #19 by the maintainer, so both
stand.

## Territories it holds in

- [Row windowing](../territory/row-windowing.md) — **converted (#19).** `measureBox` divides the first
  drawn row's screen height by `screenScale`, the scroller's own screen height over its
  `offsetHeight`. The `rowHeightRem` fallback is in layout px already and is not divided.
- [Column resize](../territory/column-resize.md) — **converted by the consumer's `scale` (#8).**
  Only the pointer is divided; `scrollLeft` is already layout px.
- [Marquee](../territory/marquee.md) — **not converted; a known hole, owned by #28.**
  Its whole press-and-bounds geometry mixes the two, read from the code:
  - the scrollbar test adds `clientWidth` / `clientHeight` (layout) to the scroller's screen
    `left` / `top`, so under `scale(2)` a press in the lower half of the view is refused as on the
    scrollbar, and under `scale(0.5)` a press on the real scrollbar is not;
  - `toCanvas` clamps the pointer to that same mixed edge, and its `y` is a screen distance plus a
    `scrollTop` delta (layout);
  - the canvas offset adds `scrollLeft` / `scrollTop` at the press to screen differences, and the
    content `bounds` subtract it from `scrollWidth` / `scrollHeight`;
  - `marqueeRange` divides that `y` by `box.rowHeight`, which since #19 is layout px, so under
    `scale(s)` a drag that has not scrolled covers `s` of the rows the pointer passes over —
    measured in Chrome with #19 applied: under `scale(0.5)` a drag over rows 3–6 selects 2–4, and
    over 15–18 selects 8–10. Before #19 the rows themselves were misplaced, so neither was right.

  #26 moves this geometry into pure functions and is a pure refactor by the maintainer's call, with
  the scale out of its scope; #28 converts the lengths in those functions once #26 has landed.
- [Auto-fit](../territory/auto-fit.md) — **not converted; symptom unmeasured.** `useColumnAutoFit`
  takes the widest ruler cell's `getBoundingClientRect().width`, so a fit taken inside a scaled copy
  may come out scaled.

## What a violation looks like

- Measured in Chrome 154, the example's grid under `transform: scale(0.5)`, before #19: rows placed
  14 px apart in layout while each is 28 tall, so each overlaps the next by 7 screen px; 64 rows drawn
  where 41 are needed; a canvas 70,000 px tall instead of 140,000; Home → PageDown landing on
  `aria-rowindex` 48 instead of 25.

## Discovery history

- #8 (2026-09-28, column resize) — measured that `scrollLeft` is in table px inside `scale(0.5)`, so
  only the pointer is divided by the consumer's `scale`.
- #9 (2026-09-29, marquee) — recorded its own scale hole in its territory note, not here.
- #19 (2026-09-30, row windowing) — the grid's row height, the second site, which promoted the rule to
  this note. Its completeness pass found the marquee's other mixed sites; #28 was filed for them.

## Where it will recur

**If code reads a length from `getBoundingClientRect` or a pointer event, and the answer meets a
length from `scrollTop`, `clientHeight`, `offsetHeight`, a width or a `style`**, it is subject to this.
Ask which px each side is in. A scale built from a whole-px layout reading (`offsetHeight`) is exact
only to half a px of that length — see [row windowing](../territory/row-windowing.md)'s snap.
