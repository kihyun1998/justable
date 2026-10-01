# Measuring the grid's box less often

The grid measures its box after every commit. `useRowWindow`'s `measure` and `useHeaderLane`'s
`measure` each run from a `useLayoutEffect` with no dependency list, and from a `ResizeObserver`.
Narrowing that, to measure only on a resize or on a change of the inputs the box depends on, is
out of scope.

## Why this is out of scope

Narrowing would save nothing. The layout `measure` forces is not an extra layout. It is the one
the frame would do anyway, moved earlier into the effect.

Measured in Chrome on the example grid, 2026-10-01: 20 root font-size steps, each followed by a
commit of the grid. Every step paid exactly one layout, forced inside the commit, and the frame
then laid out nothing. With `measure` run only at mount, the same 20 steps paid the same one
layout each, in the same time:

| tree | layouts per step | layout time, 20 steps |
|---|---|---|
| `measure` after every commit | 1, forced, none in the frame | 18.5 ms, 21.1 ms |
| `measure` only at mount | 1, forced, none in the frame | 20.2 ms, 18.7 ms |

A font-size step with no commit also cost one layout, in the frame. Something in a commit reads
layout whether or not `measure` runs: in the example it was the reveal effect reading
`el.scrollTop`. Without that read, the frame lays out instead. A profile that shows the layout
inside `measure` shows where it is attributed, not that there is more of it. PenTerm's 102 ms of
self time on `measureBox` is that case.

The scroll path was measured the same way at #25: a commit that changed the DOM cost one forced
layout, and a commit that changed nothing cost none.

Narrowing also has a price. A root font-size change does not resize the scroller, so the
`ResizeObserver` misses it, yet it moves the row height. A narrowed `measure` would need a second
trigger for it, and for a new first row, and for the header lane's gutter.

## What this does not cover

- WebView2 and PenTerm's own app-scale path were not re-measured. A host where a commit reads no
  layout and the frame would skip layout is the case that could reopen this, with a trace that
  shows two layouts in one step.
- Picking up a scale or font-size change made with no render is a correctness gap, not a cost. It
  is recorded under `docs/map/territory/row-windowing.md` § Known holes / open.

## Prior requests

- #34: "The grid measures its box on every commit, forcing style and layout after a root font-size change"
