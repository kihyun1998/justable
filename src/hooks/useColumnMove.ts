import { useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent, RefObject } from 'react';

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
  /**
   * Each pointer move and each scroll of a running move past its threshold, then `null` once when it
   * ends, however it ends. Given it, the header draws no landing line.
   */
  onDrag?: (drag: ColumnMoveDrag<K> | null) => void;
  /**
   * The other columns make room while a move runs: the moved column's seat slides to its landing slot,
   * and the slot follows the moved column's leading edge. `band` is how far, in screen px, that edge
   * must pass a column's centre before the slot changes. Without it, nothing slides.
   */
  slide?: { band: number };
}

/** One step of a running move, in screen px. */
export interface ColumnMoveDrag<K extends string> {
  /** The column being moved. */
  key: K;
  /** What a drop now would report: before this key, the end for `null`, nothing for `undefined`. */
  beforeKey: K | null | undefined;
  clientX: number;
  clientY: number;
  /** The landing line: its x, and the header row's top and bottom. */
  line: { x: number; top: number; bottom: number };
  /** The moved column's header cell, as it was when the move started. */
  cell: { left: number; top: number; right: number; bottom: number };
  /** Where the press held the moved cell, screen px from its left. */
  grab: number;
  /** The grid's scroller, or `null` outside a grid. */
  scroller: HTMLElement | null;
}

/** A running move past its threshold: the column moved, and where its landing line is in table px. */
export interface ColumnMoving<K extends string> {
  key: K;
  left: number;
}

/** The allowed slot nearest `under`; `allowed` has one entry per drawn slot. */
function nearestSlot(under: number, allowed: readonly boolean[]): number {
  let slot = -1;
  allowed.forEach((ok, s) => {
    if (ok && (slot < 0 || Math.abs(s - under) < Math.abs(slot - under))) slot = s;
  });
  return slot;
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
  return nearestSlot(
    screen.filter((box) => (box.left + box.right) / 2 < x).length,
    allowed,
  );
}

/**
 * Each drawn column's shift, layout px, for the column at `from` landing in `slot`: the columns it
 * passes move by its width toward where it was, and it moves by their widths to where it lands.
 */
export function slideShifts(widths: readonly number[], from: number, slot: number): number[] {
  const shifts = widths.map(() => 0);
  const lo = slot > from ? from + 1 : slot;
  const hi = slot > from ? slot : from;
  const toward = slot > from ? -1 : 1;
  let passed = 0;
  for (let i = lo; i < hi; i++) {
    shifts[i] = toward * widths[from]!;
    passed += widths[i]!;
  }
  shifts[from] = -toward * passed;
  return shifts;
}

/** The custom property a drawn column's header and body cells read their slide from. */
export const slideVar = (index: number) => `--justable-move-shift-${index + 1}`;

/** The custom property that is 1 on the moved column's index while a slide runs. */
export const seatVar = (index: number) => `--justable-move-seat-${index + 1}`;

/**
 * A header or body cell's own slide, read from its column's properties: `--justable-shift` and
 * `--justable-moving` (1 on the moved column, else 0). Custom properties only, so a cell at rest
 * carries no `translate` of its own.
 */
export const slideCellStyle = (index: number) =>
  ({
    '--justable-shift': `var(${slideVar(index)}, 0px)`,
    '--justable-moving': `var(${seatVar(index)}, 0)`,
  }) as CSSProperties;

/** Translates a cell by its shift, only while an ancestor carries `data-table-sliding`. */
export const SLIDE_CELL = 'justable:in-data-[table-sliding]:translate-x-(--justable-shift)';

/**
 * A header move drag: a press on a movable column's cell arms it, a move past the threshold starts
 * it, and the pressing button's release drops the column where the line shows. Escape and a lost
 * window cancel it.
 */
export function useColumnMove<K extends string>(
  columns: readonly HeaderColumn<K>[],
  options: ColumnMoveOptions<K> | undefined,
  row: RefObject<HTMLElement | null>,
  /** The grid's scroller, whose scroll moves the cells under a still pointer; absent outside a grid. */
  scroller: RefObject<HTMLElement | null> | undefined,
  /** Screen px per table px, for a scaled copy of the table: the slide's, as the border drag's. */
  scale = 1,
) {
  const [moving, setMoving] = useState<ColumnMoving<K> | null>(null);
  const drag = useDrag();

  const onMouseDown = (from: number) => (press: ReactMouseEvent) => {
    if (!options || !columns[from] || options.refusePress(press)) return;
    const { threshold, onMove, onDrag, slide } = options;
    const keys = columns.map((c) => c.key);
    const offered = options.targets(keys[from]!);
    const own = (s: number) => s === from || s === from + 1;
    // The column's own two slots drop it where it is, so they are always there to land in.
    const allowed = Array.from(
      { length: keys.length + 1 },
      (_, s) => own(s) || offered[s] !== undefined,
    );
    if (allowed.every((ok, s) => !ok || own(s))) return;

    drag.begin(press.button, scroller?.current ?? null, (end) => {
      let x = press.clientX;
      let y = press.clientY;
      let started = false;
      let cell: ColumnMoveDrag<K>['cell'] | null = null;
      /** The slide: the shifts last written, the way the pointer last moved, and where they are written. */
      let shifts: number[] | null = null;
      /** Where the shifts were written, kept: on an unmount the header's ref is gone before the end. */
      let written: HTMLElement | null = null;
      let heading: -1 | 1 = 1;
      let lastX = press.clientX;
      const slideRoot = () =>
        (scroller ? row.current?.closest<HTMLElement>('[data-table]') : null) ?? row.current;
      let slot = from;
      /** The line's place as last drawn; `null` before the first. */
      let shown: number | null = null;

      const cells = () => [
        ...(row.current?.querySelectorAll<HTMLElement>(':scope > [role="columnheader"]') ?? []),
      ];
      const pressed = cells()[from]?.getBoundingClientRect();
      const grab = press.clientX - (pressed?.left ?? press.clientX);
      const unslide = () => {
        if (written && shifts) {
          const root = written;
          shifts.forEach((_, i) => root.style.removeProperty(slideVar(i)));
          root.style.removeProperty(seatVar(from));
          root.removeAttribute('data-table-sliding');
        }
        written = null;
        shifts = null;
      };
      const update = (report: boolean) => {
        const drawn = cells();
        const boxes = drawn.map((c) => c.getBoundingClientRect());
        /** Layout px from the header row's left to where the landing line goes, with a slide. */
        let slid: number | null = null;
        let lineX: number | null = null;
        if (slide && row.current) {
          const rowBox = row.current.getBoundingClientRect();
          const widths = drawn.map((c) => c.offsetWidth);
          const planned = shifts ?? widths.map(() => 0);
          if (x !== lastX) heading = x < lastX ? -1 : 1;
          lastX = x;
          const edge =
            x - grab + (heading > 0 ? widths[from]! * scale : 0) - heading * slide.band;
          const passed = drawn.filter(
            (c, i) =>
              i !== from &&
              rowBox.left + (c.offsetLeft + planned[i]! + widths[i]! / 2) * scale < edge,
          ).length;
          slot = nearestSlot(passed + (passed > from ? 1 : 0), allowed);
          shifts = slideShifts(widths, from, slot);
          const root = written ?? slideRoot();
          if (root) {
            written = root;
            shifts.forEach((px, i) => root.style.setProperty(slideVar(i), `${px}px`));
            root.style.setProperty(seatVar(from), '1');
            root.setAttribute('data-table-sliding', '');
          }
          slid = drawn[from]!.offsetLeft + shifts[from]!;
          lineX = rowBox.left + slid * scale;
        } else {
          slot = moveSlot(boxes, allowed, x);
        }
        if (report && onDrag) {
          if (!cell) {
            const { left, top, right, bottom } = boxes[from]!;
            cell = { left, top, right, bottom };
          }
          const rowBox = row.current?.getBoundingClientRect();
          onDrag({
            key: keys[from]!,
            beforeKey: own(slot) ? undefined : offered[slot],
            clientX: x,
            clientY: y,
            line: {
              x: lineX ?? boxes[slot]?.left ?? boxes.at(-1)?.right ?? 0,
              top: rowBox?.top ?? 0,
              bottom: rowBox?.bottom ?? 0,
            },
            cell,
            grab,
            scroller: scroller?.current ?? null,
          });
        }
        const at = drawn[slot];
        const last = drawn.at(-1);
        const left =
          slid ?? (at ? at.offsetLeft : last ? last.offsetLeft + last.offsetWidth : 0);
        if (left === shown) return;
        shown = left;
        setMoving({ key: keys[from]!, left });
      };

      const cancel = () => {
        swallowNextClick();
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
        move: (ev) => {
          x = ev.clientX;
          y = ev.clientY;
          if (!started) {
            const far = Math.max(
              Math.abs(ev.clientX - press.clientX),
              Math.abs(ev.clientY - press.clientY),
            );
            if (far <= threshold) return;
            started = true;
          }
          update(true);
        },
        scroll: () => {
          if (started) update(true);
        },
        release: () => {
          if (!started) return;
          update(false);
          swallowNextClick();
          const beforeKey = offered[slot];
          if (!own(slot) && beforeKey !== undefined) {
            onMove(keys[from]!, beforeKey);
          }
        },
        ended: () => {
          window.removeEventListener('keydown', onKey, true);
          window.removeEventListener('blur', onBlur);
          unslide();
          setMoving(null);
          if (started) onDrag?.(null);
        },
      };
    });
  };

  return { moving, onMouseDown };
}
