/**
 * The example's edge scroll for a border drag: while the pointer is within `ZONE` px of the scroller's
 * left or right edge, or past it, scroll that way one step a frame. The engine never scrolls; this is
 * the consumer's side of `onResizeDrag`.
 */
import type { ResizeDrag } from 'justable';
import { useEffect, useRef } from 'react';

const ZONE = 32;
const MAX_STEP = 16;

export function useEdgeScroll() {
  const drag = useRef<ResizeDrag | null>(null);
  const frame = useRef<number | null>(null);

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  };

  const tick = () => {
    frame.current = null;
    const d = drag.current;
    if (!d?.scroller) return;
    const { left, right } = d.scroller.getBoundingClientRect();
    const into =
      d.clientX > right - ZONE ? d.clientX - (right - ZONE) : d.clientX < left + ZONE ? d.clientX - (left + ZONE) : 0;
    if (into === 0) return;
    const before = d.scroller.scrollLeft;
    d.scroller.scrollLeft += Math.sign(into) * Math.min(MAX_STEP, Math.ceil(Math.abs(into) / 2));
    if (d.scroller.scrollLeft !== before) frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (next: ResizeDrag | null) => {
    drag.current = next;
    if (next === null) stop();
    else if (frame.current === null) frame.current = requestAnimationFrame(tick);
  };
}
