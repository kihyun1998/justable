# Marquee

## What it is

A rectangle dragged over the grid's rows, as a file explorer draws one: the `marquee` prop on
`TableGrid`, the `useMarquee` hook that follows the drag from a press on the scroller to the release,
the rectangle element the grid draws on its rows' canvas, and `marqueeRange`, the pure hit-test that
turns the rectangle's vertical span into the rows it touches. The engine draws and reports
`{ anchor, head }`; it selects nothing.

## Governing decisions

- **#9, the maintainer's calls in a grilling, 2026-09-29.** Shown: the engine's existing seams
  ([mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md)),
  column resize's `refusePress` and #8's rule that the engine never scrolls for a drag. Each is a
  judgement, reversible only by the maintainer:
  - the engine draws the rectangle and reports the range; **selection stays the consumer's**, with
    no helper exported and a reference implementation only in `example/FileTable.tsx`;
  - which press starts one is a **required predicate**, and the drag threshold a **required** number
    of px — both over an engine default;
  - **auto-scroll is the consumer's**, #8 extended to the vertical axis; the scroller rides on every
    report;
  - **only the vertical span counts** for which rows are touched, over requiring overlap with a
    named column;
  - reports run **continuously** (`start`, `move`, `end`) rather than at the release alone;
  - the engine **swallows the click** a browser sends after a real drag;
  - **Escape and a lost window cancel** (`cancel`), unlike column resize, where Escape does nothing;
  - the range is **`{ anchor, head }`**, not a sorted `{ from, to }`, so the consumer can extend from
    the anchor afterwards;
  - **mouse only**, as column resize;
  - colours are two new roles, `--table-marquee-fill` and `--table-marquee-border`.

  It did not cover the pointer clamp, which move reports carry, the click swallow's bound and its
  double-click, the rectangle's content bound, Escape reaching no other handler, or which button
  ends a drag — those below are derivations.

## Design model

- **The hit-test needs what only the grid has.** The row height (`box`), the canvas the rows are
  placed on, and the scroller are the grid's; no consumer can compute which rows a rectangle covers
  without them. That is why the marquee is the engine's and the selection is not.
- **Content coordinates, both axes.** The press is stored as a point on the rows' canvas: client
  position minus the canvas's client box at the press, plus how far the scroller has scrolled since.
  So the press corner stays on the row it was pressed on while the consumer's loop scrolls. The canvas,
  not the scroller, is the origin: leading rows sit above the canvas inside the scroller, and measured
  from the scroller they would shift every row by their height.
- **Only the vertical span decides** (`marqueeRange`). A row is touched when the span overlaps its band
  `[i·h, (i+1)·h)`: a span ending exactly on a border touches nothing of the row below, a span starting
  on one starts in the row below, a zero-height span (a purely horizontal drag) keeps the row it lies
  in — on a border too, where the naive `ceil − 1` would come out one row above the start and reversed.
  The result is always one contiguous run, clamped to `0 … total − 1`; a span wholly in the floor
  below the last row, or above row 0, is `null`. `anchor` is the touched row nearest the press, so a
  press in the floor anchors on the last row once the rectangle reaches it.
- **The pointer counts at the view's edge.** A pointer past the scroller's visible box is clamped to
  it before the hit-test, so rows the consumer's loop has not yet scrolled into view are not touched —
  the rectangle grows only as the view does, as a file explorer's does. A derivation, not one of #9's
  calls.
- **The rectangle stays inside the scroller's content**, read at the press. It is absolutely placed on
  the canvas, and an absolutely placed box past the content's edge enlarges the scroll area — a
  rectangle dragged into the floor would then give the consumer's loop more room to scroll into, every
  frame, without end. A zero `scrollWidth`/`scrollHeight` is no bound
  ([zero is no measurement](../invariant/zero-is-no-measurement.md)).
- **The rectangle is never measured as a row, and is written in the DOM, not through state.**
  `measureBox` measures the canvas's first child as a row, and skips the rectangle. Drawing it after
  the rows was the first version's way round that, and did not hold: over an empty list the rectangle
  is the first child, and mid-drag the row height became its height — measured, `rowsPerPage` 1 in a
  view of 7 rows. The maintainer's call, 2026-09-29, over moving the rectangle off the canvas, which
  would have made the scroller a positioned box under other territories. In the DOM, because a React render per
  pointer move would re-run `renderRow` for every drawn row; the same choice the header lane makes for
  horizontal scroll ([header lane](header-lane.md)). It is `display: none` by class and shown by an
  inline `display: block`, so a re-render mid-drag does not touch it.
- **Which press arms.** The scroller's `mousedown`, attached only when `marquee` is given. A press past
  the view's inner edge is on a scrollbar and is ignored before the predicate is asked — the consumer
  cannot see that geometry. Every other press goes to `refusePress`; a refused press is left entirely
  alone, default included. An allowed press loses its default, so the browser starts no text
  selection, and **the grid is focused by hand** (`preventScroll`), because a press whose default is
  prevented does not move focus — without it the keyboard would stop answering after a drag.
- **Nothing is reported below the threshold**: more than `threshold` px on either axis starts it. A
  press that never passes it leaves no trace, and its click is the consumer's.
- **Every pointer move is reported, even one that keeps the range.** The consumer's edge-scroll loop
  reads the pointer from the report, and a move within one row toward the edge must reach it. A scroll
  is reported only when it changes the range. A derivation; #9's spec said "whenever the range
  changes".
- **The release's click is swallowed on `window`, capture phase, and so is the `dblclick` after it,
  bounded by the next press, never by a timer.** Measured in Chrome: a click, then a drag pressed within
  the double-click time, releases a click with `detail` 2 and then a `dblclick` on the row — which
  in a file list opens the file. Each listener leaves once it has eaten its event; a `dblclick`
  listener left waiting after a single click costs nothing, since a double-click needs a press first
  and the press removes it. Chrome sends the click as its own task after `mouseup` — measured 13 ms apart — so a
  `setTimeout(0)` bound, the first version's, can expire before the click arrives; in the one probe
  run the click still came first, so this is the ordering, not an observed miss. Every mouse click
  follows a press, so the next `mousedown` is the exact bound. A click with `detail` 0 (from a key) is not the release's and passes. The click lands
  on the press's and release's common ancestor, so it reaches a row's `onClick` only when both were on
  that row — the example's browser check drags inside one row with Ctrl for exactly that reason.
- **Escape is claimed only while a marquee runs**: `window` capture phase, `preventDefault` and
  `stopPropagation`, so a consumer's grid-level Escape (clear the selection) does not undo the restore
  its `cancel` just did. Before the threshold, Escape is the consumer's.
- **A drag cannot outlive its component or another drag** — the [drag lifetime](drag-lifetime.md)'s,
  shared with [column resize](column-resize.md). What this drag says when interrupted is its own: a
  new press **cancels** a running drag that had started — its consumer is alive and would otherwise be
  left mid-drag, its edge-scroll loop still running (column resize's `stop` tells its consumer
  `null` for the same reason); unmounting detaches every listener **without** a `cancel`, since the
  consumer it would call may be gone too.
- **Only the button that pressed releases it.** A mouseup of another button — a right press refused
  mid-drag — is ignored. A move whose `buttons` no longer hold that button ends the drag as its
  release would have: the release happened somewhere no listener saw it. The rule is the
  [drag lifetime](drag-lifetime.md)'s; #10 gave it to the border drag too.
- **`end` recomputes the range.** A list that shrank or grew under a still pointer is reported as it
  is at the release, not as it was at the last move.
- **`event` is the drag's latest mouse event.** A report caused by a scroll, Escape or blur carries
  the last pointer event, so its modifiers and its pointer are still the drag's.
- **No marquee before the grid has measured**: the rectangle is only drawn once `box` exists, and the
  press handler needs it.
- **A disabled grid starts none by its class** (`pointer-events-none`), not by a condition in the
  handler ([grid scaffold](grid-scaffold.md)). jsdom compiles no CSS, so only `check:example` holds
  it; removing the class fails it.

## Code

- `src/lib/marquee.ts` — `marqueeRange`, `MarqueeRange`, `MarqueeRangeInput`
- `src/hooks/useMarquee.ts` — `useMarquee`, `MarqueeOptions`, `MarqueeReport`, `MarqueePhase`, `MarqueeParts`, `MarqueeRows`, `swallowNextClick`
- `src/components/TableGrid.tsx` — `TableGrid`, `marquee`, `marqueeRef`, `gridRef`, `data-table-marquee`
- `example/FileTable.tsx` — `onMarquee`, `before`
- `example/edgeScroll.ts` — `useEdgeScroll`, `EdgeAxes`, `EdgeDrag`

## Reference behaviour

**None.** Windows Explorer's details view and macOS Finder were named in the grilling as the gesture
this imitates; neither was read or measured.

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  `refusePress`, `threshold` and every meaning of a range are the consumer's; the engine holds no
  default for any.
- [Zero is no measurement](../invariant/zero-is-no-measurement.md) — a zero view or content length
  neither marks a scrollbar nor bounds the rectangle.
- [Row one is the header](../invariant/row-one-is-the-header.md) — the range is in data-row indices,
  as `focus` and `renderRow` are, not `aria-rowindex`.
- [Lengths are layout px](../invariant/lengths-are-layout-px.md) — not converted: the pointer's `y` is
  divided by a layout row height; recorded under `## Known holes / open`.

## Blast radius

- [Grid scaffold](grid-scaffold.md) — owns the scroller the press lands on, the floor click the swallow
  protects, the focus the press moves, and the disabled class.
- [Row windowing](row-windowing.md) — owns `box` and the canvas; a change to how rows are placed moves
  the hit-test's origin and band.
- [Column resize](column-resize.md) — the sibling drag: its predicate seam and #8, which this extends
  to the vertical axis.
- [Drag lifetime](drag-lifetime.md) — owns when this drag ends and what interrupts it; a change there
  moves when `end` and `cancel` are reported.
- [Colour variables](colour-variables.md) — the rectangle paints through two roles.
- [Package and release](package-and-release.md) — `README.md` § Marquee and § Colours are the
  published contract.
- [Verification gates](verification-gates.md) — `check:example` drags a marquee in Chrome.

## Known holes / open

- **Touch and pen draw no marquee** — #9 keeps it mouse only.
- **A scaled copy of the table is not corrected for.** Column resize divides the pointer by `scale`;
  the marquee takes none, so inside a CSS transform the rectangle and the hit-test drift from the
  pointer, and the scrollbar test's edge moves: under `scale(2)` a press in the lower half of the
  view is refused, under `scale(0.5)` a press on the real scrollbar is not (read from the code, not
  measured). Since #19 the row height it receives is layout px while its pointer `y` is screen px, so
  under `scale(0.5)` a drag reaches half as far as the pointer (measured) — every mixed site is listed
  in [lengths are layout px](../invariant/lengths-are-layout-px.md). #26 moves this geometry without
  the scale; #28 owns the fix, after #26.
- **Right to left is not handled.** The scrollbar test looks only past the right and bottom edges; under
  `dir="rtl"` the vertical scrollbar is on the left, and a press on it could start a marquee. Dropped
  by the maintainer, 2026-09-29: nothing in the engine handles right to left, and no consumer asks.
- **The scroller is assumed not to move on screen during a drag**: its view box is read once, at the
  press.
- **One unexplained `check:example` failure**: in one run of fourteen, "Escape puts the selection back"
  read `[]` right after Escape. Not reproduced in six isolated runs or six further full runs; no cause
  is claimed.
