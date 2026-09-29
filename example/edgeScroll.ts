/**
 * The example's edge scroll for a border drag, the consumer's side of `onResizeDrag`; the engine never
 * scrolls. Within `ZONE` px of the scroller's visible left or right edge — inside its scrollbar — the
 * target speed grows with the square of the depth to `MAX_SPEED` px/s at the edge, and no faster past
 * it, so both sides reach the same top speed wherever the grid sits on screen. The speed eases toward
 * the target over about `EASE` s. Time-based, so a 144 Hz screen scrolls as fast as a 60 Hz one.
 * Sub-pixel distance carries over between frames. The release stops it at once, with no glide.
 */
import type { ResizeDrag } from '@kihyun1998/justable';
import { useEffect, useRef } from 'react';

const ZONE = 48;
const MAX_SPEED = 1000;
const EASE = 0.1;
/** A frame gap longer than this, e.g. after a hidden tab, counts as this. */
const MAX_DT = 0.05;
/** Below this speed, with no target, the loop rests. */
const REST = 1;

/** Signed target speed in px/s for a pointer at `x` against visible edges `left` and `right`. */
export function edgeSpeed(x: number, left: number, right: number): number {
  const into = x > right - ZONE ? x - (right - ZONE) : x < left + ZONE ? x - (left + ZONE) : 0;
  const depth = Math.min(1, Math.abs(into) / ZONE);
  return Math.sign(into) * MAX_SPEED * depth * depth;
}

/**
 * The scroller's visible edges in screen px: inside its border and its vertical scrollbar. The box
 * sizes are the element's own px, so they are scaled by how wide it is drawn.
 */
function visibleEdges(scroller: HTMLElement) {
  const rect = scroller.getBoundingClientRect();
  const drawn = scroller.offsetWidth > 0 ? rect.width / scroller.offsetWidth : 1;
  const left = rect.left + scroller.clientLeft * drawn;
  return { left, right: left + scroller.clientWidth * drawn };
}

export function useEdgeScroll() {
  const drag = useRef<ResizeDrag | null>(null);
  const frame = useRef<number | null>(null);
  const motion = useRef({ speed: 0, carry: 0, last: null as number | null });

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    motion.current = { speed: 0, carry: 0, last: null };
  };

  const tick = (now: number) => {
    frame.current = null;
    const d = drag.current;
    if (!d?.scroller) return;
    const m = motion.current;
    const dt = m.last === null ? 0 : Math.min(MAX_DT, (now - m.last) / 1000);
    m.last = now;

    const { left, right } = visibleEdges(d.scroller);
    const target = edgeSpeed(d.clientX, left, right);
    m.speed += (target - m.speed) * (1 - Math.exp(-dt / EASE));
    m.carry += m.speed * dt;
    const whole = Math.trunc(m.carry);
    if (whole !== 0) {
      const before = d.scroller.scrollLeft;
      d.scroller.scrollLeft = before + whole;
      m.carry -= whole;
      // At an end: nothing moved, so nothing is carried and the loop rests until the next move.
      if (d.scroller.scrollLeft === before) {
        stop();
        return;
      }
    }
    if (target === 0 && Math.abs(m.speed) < REST) {
      stop();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (next: ResizeDrag | null) => {
    drag.current = next;
    if (next === null) stop();
    else if (frame.current === null) frame.current = requestAnimationFrame(tick);
  };
}
