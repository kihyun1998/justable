# Drag lifetime

## What it is

How long a mouse drag lives, shared by the engine's two drags — the [column resize](column-resize.md)
border drag and the [marquee](marquee.md): `useDrag`, an internal hook whose `begin` attaches
`document` `mousemove` and `mouseup` and the scroller's `scroll`, decides which event is the release,
and detaches when the drag ends, when another begins, or when its component unmounts. It reports
nothing to a consumer itself; each drag says what its own moments mean.

## Governing decisions

- **#10, the maintainer's calls in triage, 2026-09-30.** Shown: the two drags' hand-kept lifetimes,
  a jsdom reproduction of the border drag ending at a right-button release under a held left button
  and following a pointer whose button was up, the two drags' opposite unmount reports, and that
  the header tests' moves carried no `buttons`. Each is a judgement, reversible only by the
  maintainer:
  - the border drag takes **both** of #9's release rules — only the pressing button's mouseup ends
    it, and a move whose `buttons` no longer hold that button ends it as its release would have;
  - the lifetime is **one primitive both drags use**, so the next rule lands in both;
  - **what an interrupted drag tells its consumer stays each drag's choice**: the primitive only says
    why it was interrupted.

  It did not cover the primitive's name or shape, `begin`'s new parameter, or whether a drag begun
  without its button keeps the old release — those below are derivations.

## Design model

- **One drag runs per hook instance.** `begin` interrupts the running one (`'replaced'`) before
  attaching; unmounting interrupts it (`'unmounted'`). A border drag and a marquee are two instances
  and never end each other.
- **The running drag is over before the new one reads anything.** `begin` interrupts first and only
  then calls `start`, where each drag reads its starting state — the border drag's `scrollLeft`, the
  marquee's canvas box, scroll offsets and content bounds. The old drag's end can move all of them: the
  border drag's `ended` lets go of the width hold, which a browser may answer by clamping `scrollLeft`,
  and a marquee consumer may put the scroll back on `cancel`. Measured 2026-09-30: the first shape of
  this hook took the handlers as a value, so each drag read its state before calling `begin`; a second
  border drag then counted the old drag's scroll change as its own (65 px came out −35), and a second
  marquee anchored 56 px off. The press's own checks — the marquee's scrollbar test and every
  `refusePress` — still run before `begin`, while the old drag runs; none of them reads what its end
  changes.
- **The release is the pressing button's.** Given `button`, a `mouseup` of another button is ignored,
  and a `mousemove` whose `buttons` lacks that button's bit is the release — the button came up where
  no listener saw it (another window, a context menu, a host that swallowed it). That move is handed
  to `release`, never to `move`, so the drag ends where the pointer last was while held, not where
  the lost release put it. `button` and `buttons` number the buttons differently (`BUTTON_BIT`: middle
  is 1 in one and 4 in the other); a button past the table has no bit and ends at its first move.
- **Without `button`, any `mouseup` releases and `buttons` is not read.** That is `useColumnResize`'s
  public `begin` called as before #10; the engine holds no default button
  ([mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md)).
  A derivation, 2026-09-30.
- **Four moments, and the order they run in.** `release` runs with the listeners still attached, then
  the drag ends. `interrupted(why)` runs before the drag ends. `ended` runs last on every path, the
  listeners already gone. `start` is handed `end`, which ends the drag from inside with no release —
  the marquee's Escape and blur. So a drag that must tell its consumer on every end reports in `ended`
  (the border drag's `null`), and one that reports only some interruptions reports in `interrupted`
  (the marquee's `cancel`, only when replaced after it started).
- **`end` has no guard against a second call.** Every caller that holds it — the marquee's Escape and
  blur listeners — is removed in `ended`, so no path calls it on a drag already over. Measured
  2026-09-30: a guard there survived every test as a mutation. A caller that keeps `end` past `ended`
  would null out a newer drag. A consumer that unmounts the component synchronously inside a release
  (`flushSync` in `onResize` or an `end` report) runs `ended` twice — a second `onDrag(null)` and
  `holdWidth(false)`, as the hand-kept lifetime before #10 did too.
- **Only the lifetime is shared.** Threshold, Escape, blur, the click swallow, scale, `Δscroll` and the
  width hold are each drag's own, attached and released through their own code.

## Code

- `src/hooks/useDrag.ts` — `useDrag`, `DragHandlers`, `DragInterruption`, `BUTTON_BIT`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  which button may start a drag is the consumer's (`refusePress`); which event ends one is this
  primitive's.

## Blast radius

- [Column resize](column-resize.md) — its drag runs on this; a change to the release moves when
  `onResizeDrag` gets `null`.
- [Marquee](marquee.md) — its drag runs on this; a change to the release moves when `end` is
  reported and the click is swallowed.
- [Verification gates](verification-gates.md) — `check:example` drags both in Chrome, where `buttons`
  is real; the jsdom tests send it by hand, and a move without it is a release.

## Known holes / open

- **Mouse only**, as both drags are.
- **Whether WebKit ever sends a move with `buttons` 0 while the button is held** — which these rules
  would take as the release — is not measured: Safari, WKWebView and WebKitGTK were not at hand.
  Chromium does not, measured 2026-09-30 with real OS input (Windows `SendInput`, not Puppeteer, which
  fills `buttons` in itself) in Chrome 154 and Edge 154: every move with the left button held carried
  `buttons` 1, and a pointer held still for 1.5 s while a loop scrolled under it drew no move at all.
- **A right click mid-drag opens the native context menu, and the menu eats the drag's release.**
  Measured 2026-09-30, the same probe, Chrome 154 and Edge 154 on Windows: left held at the edge with a
  loop scrolling, right pressed (`buttons` 3) and released — `mouseup` of button 2, then `contextmenu`,
  and the menu opened. While it was open the page received nothing: no move, no `blur`, and not the
  **left button's release**. The loop scrolled on (`scrollLeft` 706 → 1506). The first event after
  Escape closed the menu was a move with `buttons` 0. So a border drag or a marquee keeps growing with
  the consumer's loop for as long as the menu is open, and ends at the first move after it closes.
  Before #10 the border drag ended at the right release; the marquee has behaved so since #9. With
  `contextmenu` given `preventDefault` while the drag ran, no menu opened, moves kept `buttons` 1, and
  the left release arrived and stopped the loop. WebView2 is the same engine and was not measured.
