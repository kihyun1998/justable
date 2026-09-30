# Zero is no measurement

## The fact

A length read from layout that is zero, negative or not a number means **the thing was not
measured**, never that it measured zero. Every site that reads one falls back to an explicit
unmeasured behaviour, and none computes with it.

Checkable: grep the engine for a division by, a multiplication by, or a `Math.floor` of a
layout-derived length, and find the guard before it.

## Why it is cross-cutting

Layout is absent before the first paint, in a hidden or zero-height container, and always under
jsdom. Every site that reads a length meets that state, and the sites are in different territories
that do not call each other: the grid measures, the pure window function computes, the keyboard hook
pages, and auto-fit measures on its own. Each needed its own guard, and each got one separately.

## Territories it holds in

Found by reading; a grep for `> 0` or `|| ` over `src/` finds most but not all of them, since the
guard is written differently at each site.

- [Row windowing](../territory/row-windowing.md) — `visibleRange` treats `!(rowHeight > 0)` as
  unmeasured and draws the first `UNMEASURED_ROWS`; `scrollToReveal` answers `null` for a zero row or
  viewport; `measureBox` keeps `box` at `null` for a zero `clientHeight`, falls back to `rowHeightRem`
  for a zero row height and to 16 px for an unparsable root font size.
- [Keyboard movement](../territory/keyboard-movement.md) — `rowsPerPage` of 0 pages by
  `FALLBACK_PAGE` (1).
- [Auto-fit](../territory/auto-fit.md) — a ruler that measured nothing answers `null`, never 0.
- [Marquee](../territory/marquee.md) — a zero view width or height neither marks a press as on a
  scrollbar nor clamps the pointer; a zero `scrollWidth` or `scrollHeight` bounds the rectangle
  nowhere (`Infinity`); `marqueeRange` answers `null` for `!(rowHeight > 0)`.

## What a violation looks like

- Windowing against a zero viewport draws **one row** of a long list.
- An unguarded zero **row height** is worse and opposite: `viewport / 0` is `Infinity`, and a window
  of `0..Infinity` draws **every** row — for a 5,000-row list, the three-second first paint windowing
  exists to remove. Failing safe means drawing few, not all.
- A page of zero rows makes PageDown do nothing.
- An auto-fit answer of 0 is clamped up to the column's minimum and looks like a fit.

The live gap: `measureBox` guards the viewport but not the row height. It accepts a `box` whose
`rowHeight` is 0 when the first drawn row measures 0 **and** `rowHeightRem` is 0. `visibleRange`
then falls back safely, but row placement (`index × rowHeight`) stacks every row at the top and the
page size written to the keyboard becomes `Infinity`, so PageDown jumps to the last row. Reachable
only with `rowHeightRem={0}` and a zero-height row.

## Discovery history

Each guard was added by a different slice in PenTerm, each re-deciding the same rule:

- `penterm 5bf00320d` (2026-08-26, windowing) — a zero viewport is no measurement.
- `penterm e99f7e6ff` (2026-08-26, keyboard walking) — a page is at least one row, since the viewport
  measures 0 before layout.
- Auto-fit's `null` for nothing measured — present when the engine was split out
  (`penterm 1b3bc40a3`); its first form is older.

Three sites, three slices, one rule, and no node that named it until this one.

- #9 (2026-09-29, marquee) — the first site written against this note rather than rediscovering the
  rule: its guards cite it.

## Where it will recur

**If a function reads a length from layout** — `clientHeight`, `getBoundingClientRect`, a computed
style, a `ResizeObserver` entry — it is subject to this. Ask what it does when the length is 0, and
whether the answer is an explicit unmeasured state rather than arithmetic on 0.
