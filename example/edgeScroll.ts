/**
 * The example's edge scroll for a drag, the consumer's side of `onResizeDrag` and `onMarquee`; the
 * engine never scrolls. Within `ZONE` px of the scroller's visible edge on a scrolled axis — inside its
 * scrollbars — the target speed grows with the square of the depth to `MAX_SPEED` px/s at the edge,
 * and no faster past it, so both sides reach the same top speed wherever the grid sits on screen. The
 * speed eases toward the target over about `EASE` s. Time-based, so a 144 Hz screen scrolls as fast
 * as a 60 Hz one. Sub-pixel distance carries over between frames. The release stops it at once, with
 * no glide.
 */
import { useEffect, useRef } from 'react';

const ZONE = 48;
const MAX_SPEED = 1000;
const EASE = 0.1;
/** A frame gap longer than this, e.g. after a hidden tab, counts as this. */
const MAX_DT = 0.05;
/** Below this speed, with no target, the loop rests. */
const REST = 1;

/** Where a running drag's pointer is, and the scroller it may scroll. */
export interface EdgeDrag {
  clientX: number;
  clientY: number;
  scroller: HTMLElement | null;
}

/** Which axes a drag scrolls: a border drag only across, a marquee both ways. */
export type EdgeAxes = 'x' | 'xy';

/** Signed target speed in px/s for a pointer at `at` against visible edges `low` and `high`. */
export function edgeSpeed(at: number, low: number, high: number): number {
  const into = at > high - ZONE ? at - (high - ZONE) : at < low + ZONE ? at - (low + ZONE) : 0;
  const depth = Math.min(1, Math.abs(into) / ZONE);
  return Math.sign(into) * MAX_SPEED * depth * depth;
}

/**
 * The scroller's visible edges in screen px: inside its border and its scrollbars. The box sizes are
 * the element's own px, so they are scaled by how large it is drawn.
 */
function visibleEdges(scroller: HTMLElement) {
  const rect = scroller.getBoundingClientRect();
  const wide = scroller.offsetWidth > 0 ? rect.width / scroller.offsetWidth : 1;
  const tall = scroller.offsetHeight > 0 ? rect.height / scroller.offsetHeight : 1;
  const left = rect.left + scroller.clientLeft * wide;
  const top = rect.top + scroller.clientTop * tall;
  return {
    left,
    right: left + scroller.clientWidth * wide,
    top,
    bottom: top + scroller.clientHeight * tall,
  };
}

interface Motion {
  speed: number;
  carry: number;
}

const still = (): Motion => ({ speed: 0, carry: 0 });

export function useEdgeScroll(axes: EdgeAxes) {
  const drag = useRef<EdgeDrag | null>(null);
  const frame = useRef<number | null>(null);
  const last = useRef<number | null>(null);
  const motion = useRef({ x: still(), y: still() });

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    last.current = null;
    motion.current = { x: still(), y: still() };
  };

  /** Moves one axis a frame's worth; whether that axis still has somewhere to go. */
  const step = (m: Motion, target: number, dt: number, read: () => number, write: (v: number) => void) => {
    m.speed += (target - m.speed) * (1 - Math.exp(-dt / EASE));
    m.carry += m.speed * dt;
    const whole = Math.trunc(m.carry);
    if (whole !== 0) {
      const before = read();
      write(before + whole);
      m.carry -= whole;
      // At an end: nothing moved, so nothing is carried and this axis rests.
      if (read() === before) {
        Object.assign(m, still());
        return false;
      }
    }
    return !(target === 0 && Math.abs(m.speed) < REST);
  };

  const tick = (now: number) => {
    frame.current = null;
    const d = drag.current;
    const scroller = d?.scroller;
    if (!d || !scroller) return;
    const dt = last.current === null ? 0 : Math.min(MAX_DT, (now - last.current) / 1000);
    last.current = now;

    const edges = visibleEdges(scroller);
    const across = step(
      motion.current.x,
      edgeSpeed(d.clientX, edges.left, edges.right),
      dt,
      () => scroller.scrollLeft,
      (v) => {
        scroller.scrollLeft = v;
      },
    );
    const down =
      axes === 'xy' &&
      step(
        motion.current.y,
        edgeSpeed(d.clientY, edges.top, edges.bottom),
        dt,
        () => scroller.scrollTop,
        (v) => {
          scroller.scrollTop = v;
        },
      );
    if (!across && !down) {
      stop();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };

  useEffect(() => stop, []);

  return (next: EdgeDrag | null) => {
    drag.current = next;
    if (next === null) stop();
    else if (frame.current === null) frame.current = requestAnimationFrame(tick);
  };
}
