import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import { type MarqueeRange, marqueeRange } from '../lib/marquee.js';
import { useDrag } from './useDrag.js';

/** What a report says happened: the drag passed its threshold, moved, was released, or was abandoned. */
export type MarqueePhase = 'start' | 'move' | 'end' | 'cancel';

/** One report of a running marquee. */
export interface MarqueeReport {
  phase: MarqueePhase;
  /** The rows the rectangle touches now; `null` while it touches none. */
  range: MarqueeRange | null;
  /** The latest mouse event of the drag, for its modifiers and its pointer. */
  event: MouseEvent;
  /** The grid's scroller, for the consumer's edge-scroll loop. */
  scroller: HTMLElement;
}

/** The consumer's side of a marquee. Every field is its choice; none has a default. */
export interface MarqueeOptions {
  /** Whether this press on the scroller may start a marquee. A refused press is left untouched. */
  refusePress: (event: ReactMouseEvent) => boolean;
  /** How far, in px on either axis, the pointer moves before a press becomes a marquee. */
  threshold: number;
  onMarquee: (report: MarqueeReport) => void;
}

/** The elements a marquee reads and draws on, all owned by the grid. */
export interface MarqueeParts {
  grid: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  canvas: RefObject<HTMLElement | null>;
  rectangle: RefObject<HTMLElement | null>;
}

/** The measured rows a marquee hit-tests; `null` before the grid has measured. */
export interface MarqueeRows {
  rowHeight: number;
  total: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * A rectangle dragged over the grid's rows: a press on the scroller arms it, `document` mousemove
 * and the scroller's scroll move it, mouseup ends it, Escape and a lost window cancel it. It draws
 * and reports; it selects nothing. The rules: `docs/map/territory/marquee.md`.
 */
export function useMarquee(
  options: MarqueeOptions | undefined,
  parts: MarqueeParts,
  rows: MarqueeRows | null,
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const drag = useDrag();

  const onMouseDown = (press: ReactMouseEvent<HTMLElement>) => {
    const scroller = parts.scroller.current;
    const canvas = parts.canvas.current;
    const rectangle = parts.rectangle.current;
    const options = optionsRef.current;
    if (!options || !scroller || !canvas || !rectangle) return;

    const view = scroller.getBoundingClientRect();
    const viewLeft = view.left + scroller.clientLeft;
    const viewTop = view.top + scroller.clientTop;
    const viewWidth = scroller.clientWidth;
    const viewHeight = scroller.clientHeight;
    // A press past the view's inner edge is on a scrollbar. A zero length is no measurement:
    // `docs/map/invariant/zero-is-no-measurement.md`.
    if (viewWidth > 0 && press.clientX >= viewLeft + viewWidth) return;
    if (viewHeight > 0 && press.clientY >= viewTop + viewHeight) return;
    if (options.refusePress(press)) return;

    press.preventDefault();
    parts.grid.current?.focus({ preventScroll: true });

    drag.begin(press.button, scroller, (end) => {
      const { threshold } = options;
      const at = canvas.getBoundingClientRect();
      const scrollLeft0 = scroller.scrollLeft;
      const scrollTop0 = scroller.scrollTop;
      /** The canvas's offset inside the scroller's content, which leading rows push down. */
      const canvasLeft = at.left - viewLeft + scrollLeft0;
      const canvasTop = at.top - viewTop + scrollTop0;
      /** The scroller's content in canvas px, as it was at the press; a zero length bounds nothing. */
      const bounds = {
        left: -canvasLeft,
        top: -canvasTop,
        right: scroller.scrollWidth > 0 ? scroller.scrollWidth - canvasLeft : Infinity,
        bottom: scroller.scrollHeight > 0 ? scroller.scrollHeight - canvasTop : Infinity,
      };
      const toCanvas = (clientX: number, clientY: number) => {
        const x = viewWidth > 0 ? clamp(clientX, viewLeft, viewLeft + viewWidth) : clientX;
        const y = viewHeight > 0 ? clamp(clientY, viewTop, viewTop + viewHeight) : clientY;
        return {
          x: x - at.left + scroller.scrollLeft - scrollLeft0,
          y: y - at.top + scroller.scrollTop - scrollTop0,
        };
      };

      const origin = toCanvas(press.clientX, press.clientY);
      let pointer = { clientX: press.clientX, clientY: press.clientY };
      let last: MouseEvent = press.nativeEvent;
      let started = false;
      let range: MarqueeRange | null = null;

      const update = () => {
        const measured = rowsRef.current;
        const here = toCanvas(pointer.clientX, pointer.clientY);
        range = measured ? marqueeRange({ from: origin.y, to: here.y, ...measured }) : null;
        const left = clamp(Math.min(origin.x, here.x), bounds.left, bounds.right);
        const right = clamp(Math.max(origin.x, here.x), bounds.left, bounds.right);
        const top = clamp(Math.min(origin.y, here.y), bounds.top, bounds.bottom);
        const bottom = clamp(Math.max(origin.y, here.y), bounds.top, bounds.bottom);
        Object.assign(rectangle.style, {
          left: `${left}px`,
          top: `${top}px`,
          width: `${right - left}px`,
          height: `${bottom - top}px`,
        });
      };
      const report = (phase: MarqueePhase) =>
        optionsRef.current?.onMarquee({ phase, range, event: last, scroller });

      const onMove = (ev: MouseEvent) => {
        last = ev;
        pointer = { clientX: ev.clientX, clientY: ev.clientY };
        if (!started) {
          const far = Math.max(
            Math.abs(ev.clientX - press.clientX),
            Math.abs(ev.clientY - press.clientY),
          );
          if (far <= threshold) return;
          started = true;
          rectangle.style.display = 'block';
          update();
          report('start');
          return;
        }
        update();
        report('move');
      };
      const onScroll = () => {
        if (!started) return;
        const before = range;
        update();
        if (before?.anchor !== range?.anchor || before?.head !== range?.head) report('move');
      };
      const onRelease = (ev: MouseEvent) => {
        last = ev;
        if (!started) return;
        update();
        report('end');
        swallowNextClick();
      };
      const cancel = () => {
        report('cancel');
        end();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (!started || ev.key !== 'Escape') return;
        ev.preventDefault();
        ev.stopPropagation();
        cancel();
      };
      const onBlur = () => {
        if (started) cancel();
        else end();
      };

      window.addEventListener('keydown', onKey, true);
      window.addEventListener('blur', onBlur);
      return {
        move: onMove,
        scroll: onScroll,
        release: onRelease,
        interrupted: (why) => {
          if (why === 'replaced' && started) report('cancel');
        },
        ended: () => {
          window.removeEventListener('keydown', onKey, true);
          window.removeEventListener('blur', onBlur);
          rectangle.style.display = '';
        },
      };
    });
  };

  return { onMouseDown };
}

/**
 * Eats the one mouse click a browser sends for the release that ended a marquee, and the double-click
 * that follows it when the drag was pressed as a second click; gives up at the next press. A click
 * with no press behind it (`detail` 0, e.g. from a key) passes.
 */
function swallowNextClick() {
  const swallow = (ev: MouseEvent) => {
    if (ev.detail === 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    window.removeEventListener(ev.type as 'click' | 'dblclick', swallow, true);
  };
  const off = () => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('dblclick', swallow, true);
    window.removeEventListener('mousedown', off, true);
  };
  window.addEventListener('click', swallow, true);
  window.addEventListener('dblclick', swallow, true);
  window.addEventListener('mousedown', off, true);
}
