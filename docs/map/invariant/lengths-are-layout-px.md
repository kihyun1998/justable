# Lengths are layout px

## The fact

A length the engine computes with — a row height, a width, a scroll offset, a `top` — is in
**layout px**, the px a transform does not change. A length read on screen (a pointer's `clientX` /
`clientY`, a `getBoundingClientRect`) is in **screen px**, after every transform on an ancestor, and
is converted before it meets a layout length. Both are read from the browser's layout in the sense
[zero is no measurement](zero-is-no-measurement.md) uses; what differs is whether a transform has
been applied.

Checkable: every `getBoundingClientRect` and every pointer coordinate under `src/` either meets
only other screen lengths (a drag's threshold is one pointer distance against another; the marquee's
view edge, a layout length multiplied by the scale into screen px) or passes through a division by a
scale before it meets `scrollTop`, `scrollLeft`, `clientWidth`, `clientHeight`, `offsetHeight`, a
width or a `top`. The sites below say which, and where a site does
neither.

## Why it is cross-cutting

A scaled copy of the table — a CSS `transform: scale(…)` on an ancestor, as a columns preview draws —
is invisible to every layout reading and visible to every screen reading. `clientHeight`,
`offsetHeight`, `scrollTop`, `scrollLeft` and an element's own `style` stay in layout px;
`getBoundingClientRect` and the pointer do not. The sites that mix the two are in territories that do
not call each other, and each meets the transform on its own.

**Two conventions, deliberately.** Column resize takes the scale from the consumer (`scale`, #8); the
grid works its scale out itself (#19), and so does the marquee (#28). Unifying them was left out of
#19 and #28 by the maintainer, so both stand.

## Territories it holds in

- [Row windowing](../territory/row-windowing.md) — **not read on screen at all, since #47.**
  `useRowWindow`'s `measure` takes the first drawn row's height from its computed `height`, which no
  transform touches, so no conversion applies; the `rowHeightRem` fallback was always in layout px.
  **Converted (#19), withdrawn (#47):** it used to divide the row's screen height by `screenScale`,
  the scroller's own screen height over its `offsetHeight` — a conversion that was correct in units
  and still unstable, because the row's screen height moves with its sub-px position and the quotient
  never settled. **Converted (#46):** the canvas's offset — the canvas's client top less the
  scroller's — is divided by `marqueeScale`, the longer element's, before `scrollTop` is added, since
  that distance grows with the scroll as the marquee's does. It is now this territory's only screen
  reading.
- [Column resize](../territory/column-resize.md) — **converted by the consumer's `scale` (#8).**
  Only the pointer is divided; `scrollLeft` is already layout px.
- [Marquee](../territory/marquee.md) — **converted (#28)**, measuring its scale as the grid does,
  with `screenScale`, but over the longer of the scroller and the canvas, read once at the press.
  - `marqueeView` takes the scale and multiplies the scroller's layout lengths — `clientLeft` /
    `clientTop` and `clientWidth` / `clientHeight` — into screen px, so the view's edge meets the
    pointer in one unit; `pressOnScrollbar` and `toCanvas`'s clamp read it. The borders were a mixed
    site the issue did not list.
  - `marqueeFrame` and `toCanvas` divide each whole screen difference — canvas box less view, pointer
    less canvas box — by the scale before it meets a scroll offset. The canvas point, the bounds and
    the rectangle are layout px, and so is the `y` `marqueeRange` divides by the row height.
  - The drag threshold stays in screen px: one pointer distance against another.

  Measured in Chrome before #28, with #19 applied: under `scale(0.5)` a drag over rows 3–6 selected
  2–4, and over 15–18 selected 8–10. `check:example` now drags rows 3–6 under `scale(0.5)` and gets
  3–6, and the same check with the hook's scale forced to 1 gets 2–4 again.
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
- #28 (2026-10-01, marquee) — converted those sites once #26 had made them pure functions. Reading
  them found one more the issue had not listed: the scroller's border widths, `clientLeft` /
  `clientTop`, are layout px too, and were added to its screen `left` / `top`.
- #47 (2026-10-06, row windowing) — the first site **removed** rather than converted, and the lesson
  this note did not hold: a correct conversion is not a stable one. The row's screen height was
  divided by the right ratio and still gave three to five values across a scroll sweep under an
  inexact scale, which looped the grid's render. Where a layout reading of the same length exists —
  here the computed `height` — it is preferable to converting a screen one, because it needs no
  ratio and cannot wobble. Of the screen readings left, only the pointer has no layout equivalent.
  The canvas's offset has one — `check:example` reads it as `offsetTop` differences — and #46 kept
  it on screen so as not to assume the scroller is the canvas's `offsetParent`; auto-fit's width
  has one too, and is not converted at all (above).

## Where it will recur

**If code reads a length from `getBoundingClientRect` or a pointer event, and the answer meets a
length from `scrollTop`, `clientHeight`, `offsetHeight`, a width or a `style`**, it is subject to this.
Ask which px each side is in. A scale built from a whole-px layout reading (`offsetHeight`) is exact
only to half a px of that length — see [row windowing](../territory/row-windowing.md)'s snap — and
that error is multiplied by every length it divides: a distance far longer than the element measured
needs a longer element ([marquee](../territory/marquee.md), #28).
