import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import type { HeaderColumn } from '../types.js';
import { useDrag } from './useDrag.js';
import { swallowNextClick } from './useMarquee.js';

/** The consumer's side of a header move drag. Every field is its choice; none has a default. */
export interface ColumnMoveOptions<K extends string> {
  /** Whether this press on a header cell may start a move. A refused press is left untouched. */
  refusePress: (event: ReactMouseEvent) => boolean;
  /** How far, in screen px on either axis, the pointer moves before a press becomes a move. */
  threshold: number;
  /**
   * Where `key` may land, per drawn slot — before each drawn column, then the end: the `beforeKey` to
   * report for a drop there, or `undefined` where none is allowed. The model's `moveTargets`.
   */
  targets: (key: K) => readonly (K | null | undefined)[];
  /** The drop: `key` goes before `beforeKey`, or to the end for `null`. */
  onMove: (key: K, beforeKey: K | null) => void;
}

/** A running move past its threshold: the column moved, and where its landing line is in table px. */
export interface ColumnMoving<K extends string> {
  key: K;
  left: number;
}

/**
 * The drawn slot a move lands in — before each drawn column, then `screen.length` for the end — for a
 * pointer at `x`: the allowed slot nearest the one under the pointer. `screen` is each column's screen
 * box; `allowed` has one entry per slot.
 */
export function moveSlot(
  screen: readonly { left: number; right: number }[],
  allowed: readonly boolean[],
  x: number,
): number {
  const under = screen.filter((box) => (box.left + box.right) / 2 < x).length;
  let slot = -1;
  allowed.forEach((ok, s) => {
    if (ok && (slot < 0 || Math.abs(s - under) < Math.abs(slot - under))) slot = s;
  });
  return slot;
}

/**
 * A header move drag: a press on a movable column's cell arms it, a move past the threshold starts
 * it, and the pressing button's release drops the column where the line shows.
 */
export function useColumnMove<K extends string>(
  columns: readonly HeaderColumn<K>[],
  options: ColumnMoveOptions<K> | undefined,
  row: RefObject<HTMLElement | null>,
  /** The grid's scroller, whose scroll moves the cells under a still pointer; absent outside a grid. */
  scroller: RefObject<HTMLElement | null> | undefined,
) {
  const [moving, setMoving] = useState<ColumnMoving<K> | null>(null);
  const drag = useDrag();

  const onMouseDown = (from: number) => (press: ReactMouseEvent) => {
    if (!options || !columns[from] || options.refusePress(press)) return;
    const { threshold, onMove } = options;
    const keys = columns.map((c) => c.key);
    const offered = options.targets(keys[from]!);
    const own = (s: number) => s === from || s === from + 1;
    // The column's own two slots drop it where it is, so they are always there to land in.
    const allowed = Array.from(
      { length: keys.length + 1 },
      (_, s) => own(s) || offered[s] !== undefined,
    );
    if (allowed.every((ok, s) => !ok || own(s))) return;

    drag.begin(press.button, scroller?.current ?? null, () => {
      let x = press.clientX;
      let started = false;
      let slot = from;
      /** The line's place as last drawn; `null` before the first. */
      let shown: number | null = null;

      const cells = () => [
        ...(row.current?.querySelectorAll<HTMLElement>(':scope > [role="columnheader"]') ?? []),
      ];
      const update = () => {
        const drawn = cells();
        slot = moveSlot(
          drawn.map((cell) => cell.getBoundingClientRect()),
          allowed,
          x,
        );
        const at = drawn[slot];
        const last = drawn.at(-1);
        const left = at ? at.offsetLeft : last ? last.offsetLeft + last.offsetWidth : 0;
        if (left === shown) return;
        shown = left;
        setMoving({ key: keys[from]!, left });
      };

      return {
        move: (ev) => {
          x = ev.clientX;
          if (!started) {
            const far = Math.max(
              Math.abs(ev.clientX - press.clientX),
              Math.abs(ev.clientY - press.clientY),
            );
            if (far <= threshold) return;
            started = true;
          }
          update();
        },
        scroll: () => {
          if (started) update();
        },
        release: () => {
          if (!started) return;
          update();
          swallowNextClick();
          const beforeKey = offered[slot];
          if (!own(slot) && beforeKey !== undefined) {
            onMove(keys[from]!, beforeKey);
          }
        },
        ended: () => setMoving(null),
      };
    });
  };

  return { moving, onMouseDown };
}
