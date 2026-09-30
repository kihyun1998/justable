/**
 * The grid's header lane kept over the rows: its right gutter padded to the scroller's, its inner box
 * following the rows' horizontal scroll, the spacer that extends the scroller's content past an empty
 * gutter, and the hold on the content's width during a border drag.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

import type { GridScroller } from '../components/gridScroller.js';

/** Whether this document's engine withholds an empty reserved gutter from the horizontal scroll end. */
interface GutterWithheld {
  /** With the scroller's content shorter than it. */
  short: boolean;
  /** With the scroller's content taller than it. */
  tall: boolean;
}

const gutterWithheld = new WeakMap<Document, GutterWithheld>();

/**
 * Whether an offscreen scroller reserving its gutter stops its horizontal scroll short of
 * `scrollWidth − clientWidth`, with short content and with tall; measured once per document.
 */
function emptyGutterWithheld(doc: Document): GutterWithheld {
  const known = gutterWithheld.get(doc);
  if (known) return known;
  if (!doc.body) return { short: false, tall: false };
  const probe = doc.createElement('div');
  probe.style.cssText =
    'position:absolute;top:0;left:-10000px;width:100px;height:100px;overflow:auto;scrollbar-gutter:stable;visibility:hidden';
  const content = doc.createElement('div');
  probe.appendChild(content);
  doc.body.appendChild(probe);
  const shortfall = (height: number) => {
    content.style.cssText = `width:200px;height:${height}px`;
    probe.scrollLeft = probe.scrollWidth;
    // The half px is deliberate: `docs/map/territory/header-lane.md`.
    return probe.scrollWidth - probe.clientWidth - probe.scrollLeft > 0.5;
  };
  const measured = { short: shortfall(10), tall: shortfall(300) };
  probe.remove();
  gutterWithheld.set(doc, measured);
  return measured;
}

export interface HeaderLaneInput {
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** The rows' canvas, whose width the border drag holds. */
  canvasRef: RefObject<HTMLDivElement | null>;
  /** Measured again, before the lane, when the hold is released; reads only refs. */
  remeasure: () => void;
}

export interface HeaderLane {
  laneRef: RefObject<HTMLDivElement | null>;
  laneInnerRef: RefObject<HTMLDivElement | null>;
  /** The scroller's last child, after the canvas. */
  spacerRef: RefObject<HTMLDivElement | null>;
  /** Takes the scroller's horizontal offset. */
  onScroll: (scrollLeft: number) => void;
  /** What the header receives. */
  gridScroller: GridScroller;
}

export function useHeaderLane({ scrollerRef, canvasRef, remeasure }: HeaderLaneInput): HeaderLane {
  const laneRef = useRef<HTMLDivElement>(null);
  const laneInnerRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  /** How far the spacer extends the scroller's content past its own right end, in px. */
  const spacerPadRef = useRef(0);

  const measure = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const gutter = el.offsetWidth - el.clientWidth;

    // The spacer past an empty gutter: `docs/map/territory/header-lane.md`. A zero viewport is no
    // measurement: `docs/map/invariant/zero-is-no-measurement.md`.
    const spacer = el.clientHeight > 0 ? spacerRef.current : null;
    let shown = false;
    let content = 0;
    if (spacer) {
      const withheld = emptyGutterWithheld(el.ownerDocument);
      const empty = gutter > 0 && (el.scrollHeight > el.clientHeight ? withheld.tall : withheld.short);
      if (empty) {
        for (const child of el.children) {
          if (child !== spacer && child instanceof HTMLElement) {
            content = Math.max(content, child.scrollWidth);
          }
        }
      }
      shown = content > el.clientWidth;
    }

    // Both written by hand and never by React: `docs/map/territory/header-lane.md`.
    const lane = laneRef.current;
    if (lane) lane.style.paddingRight = `${gutter}px`;
    if (spacer) {
      const width = shown ? `${content + gutter}px` : '';
      if (spacer.style.width !== width) spacer.style.width = width;
      if (spacer.style.display !== (shown ? 'block' : '')) spacer.style.display = shown ? 'block' : '';
      spacerPadRef.current = shown ? gutter : 0;
    }
  };

  useLayoutEffect(measure);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // Attached once, deliberately: `docs/map/territory/header-lane.md`.
  }, []);

  // The content never narrows during a border drag: `docs/map/territory/column-resize.md`.
  const gridScroller = useMemo<GridScroller>(
    () => ({
      scrollerRef,
      holdWidth: (on) => {
        const canvas = canvasRef.current;
        const el = scrollerRef.current;
        if (!canvas || !el) return;
        canvas.style.minWidth = on
          ? `${Math.max(Number.parseFloat(canvas.style.minWidth) || 0, el.scrollWidth - spacerPadRef.current)}px`
          : '';
        // Released, the spacer is re-measured: `docs/map/territory/header-lane.md`.
        if (!on) {
          remeasure();
          measure();
        }
      },
    }),
    [],
  );

  return {
    laneRef,
    laneInnerRef,
    spacerRef,
    // Horizontal follows in the DOM directly, not through state:
    // `docs/map/territory/header-lane.md`.
    onScroll: (scrollLeft) => {
      const inner = laneInnerRef.current;
      if (inner) inner.style.transform = `translateX(${-scrollLeft}px)`;
    },
    gridScroller,
  };
}
