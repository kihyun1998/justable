/**
 * A windowed `role="grid"`: a non-scrolling header lane over a native scroller that draws only the
 * rows the viewport can see. One focusable container; rows carry no `tabIndex`, and the focused row
 * is named by `aria-activedescendant`.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import type { TableKeyboardLink } from '../hooks/useTableKeyboard.js';
import { classNames } from '../lib/classNames.js';
import { UNMEASURED_ROWS, scrollToReveal, visibleRange } from '../lib/rowWindow.js';

/** Where a data row sits. */
export interface RowPlace {
  /** The id `aria-activedescendant` points at. */
  id: string;
  /** 1-based position in the whole grid, the header being row 1. */
  rowIndex: number;
  focused: boolean;
  /** Absolute placement once the viewport is measured; `undefined` before, when rows flow. */
  style: CSSProperties | undefined;
}

export interface TableGridProps {
  label: string;
  header: ReactNode;
  colCount: number;
  /** How many data rows there are in all. */
  total: number;
  /** Draws data row `index`; called only for the rows in the window. */
  renderRow: (index: number, place: RowPlace) => ReactNode;
  /** A stable identity for data row `index`, so a re-sort moves rows rather than their state. */
  rowKey: (index: number) => string;
  /** Rows above the data, each told its `aria-rowindex`. They are never windowed. */
  leadingRows?: readonly ((rowIndex: number) => ReactNode)[];
  /** `false` draws no data rows — the consumer is showing something else instead. */
  showRows?: boolean;
  /** Take the remaining height; `false` shrinks the grid to its header. */
  fill: boolean;
  /** The keyboard's row, as a data-row index. */
  focus: number | null;
  /** Prefix for row ids; unique per grid. */
  rowIdPrefix: string;
  /** Dead to every gesture, by one CSS line rather than a condition per handler. */
  disabled?: boolean;
  /** A row's height in `rem`, used only before a real row has been measured. */
  rowHeightRem: number;
  /** `useTableKeyboard`'s link; the grid writes the rows a page moves by into it. */
  keyboard?: TableKeyboardLink;
  /** A press on the scroller itself, not on a row. */
  onFloorClick?: () => void;
  /** Wraps the scroller, e.g. in a context-menu trigger. */
  wrapScroller?: (scroller: ReactElement) => ReactNode;
  /** Extra attributes for the scroller element. */
  scrollerProps?: Record<string, string | boolean>;
}

export function TableGrid({
  label,
  header,
  colCount,
  total,
  renderRow,
  rowKey,
  leadingRows = [],
  showRows = true,
  fill,
  focus,
  rowIdPrefix,
  disabled = false,
  rowHeightRem,
  keyboard,
  onFloorClick,
  wrapScroller,
  scrollerProps,
}: TableGridProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const laneInnerRef = useRef<HTMLDivElement>(null);
  // Read through a ref, so the once-attached observer's closure never holds a stale value.
  const rowHeightRemRef = useRef(rowHeightRem);
  rowHeightRemRef.current = rowHeightRem;

  // Scroll and size are separate state: measuring inside the scroll handler forces layout every frame.
  const [scrollTop, setScrollTop] = useState(0);
  const [box, setBox] = useState<{ viewportHeight: number; rowHeight: number } | null>(null);

  const measureBox = () => {
    const el = scrollerRef.current;
    if (!el) return;

    // The lane is `overflow-x: clip`, which reserves no gutter, so it takes the scroller's by hand.
    // React never writes this property — one owner.
    const lane = laneRef.current;
    if (lane) lane.style.paddingRight = `${el.offsetWidth - el.clientWidth}px`;

    // A zero viewport is no measurement; `box` stays null and rows flow unwindowed.
    if (el.clientHeight <= 0) return;
    const row = canvasRef.current?.firstElementChild;
    const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const next = {
      viewportHeight: el.clientHeight,
      rowHeight: row?.getBoundingClientRect().height || rowHeightRemRef.current * rootPx,
    };
    setBox((prev) =>
      prev && prev.viewportHeight === next.viewportHeight && prev.rowHeight === next.rowHeight
        ? prev
        : next,
    );
  };

  useLayoutEffect(measureBox);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measureBox);
    ro.observe(el);
    return () => ro.disconnect();
    // Attached once: `measureBox` reads only refs and calls setBox, so the first closure stays correct.
  }, []);

  // Bring the focused row back into view; under windowing it may not be in the DOM to scroll to.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !box || focus === null) return;
    // Reads the offset from the element so a scroll alone does not re-run this and pull the list back.
    const next = scrollToReveal(focus, { scrollTop: el.scrollTop, ...box });
    if (next !== null) el.scrollTop = next;
  }, [focus, box]);

  useEffect(() => {
    if (box && keyboard) keyboard.rowsPerPage = Math.floor(box.viewportHeight / box.rowHeight);
  }, [box, keyboard]);

  const rowWindow = box
    ? visibleRange({ scrollTop, ...box, total })
    : { start: 0, end: Math.min(total, UNMEASURED_ROWS) };
  const rowId = (index: number) => `${rowIdPrefix}-row-${index}`;
  const firstDataRow = 2 + leadingRows.length;

  const drawn: ReactNode[] = [];
  if (showRows) {
    for (let index = rowWindow.start; index < rowWindow.end; index += 1) {
      drawn.push(
        <Fragment key={rowKey(index)}>
          {renderRow(index, {
            id: rowId(index),
            rowIndex: firstDataRow + index,
            focused: focus === index,
            // `right: 0` as well as `left`, or an absolute row shrinks to fit and the filler track collapses.
            style: box
              ? { position: 'absolute', top: index * box.rowHeight, left: 0, right: 0 }
              : undefined,
          })}
        </Fragment>,
      );
    }
  }

  const scroller = (
    <div
      role="rowgroup"
      ref={scrollerRef}
      {...scrollerProps}
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
        // Horizontal follows in the DOM directly; through state the header would trail by a frame.
        const inner = laneInnerRef.current;
        if (inner) inner.style.transform = `translateX(${-e.currentTarget.scrollLeft}px)`;
      }}
      // `scrollbar-gutter: stable`, so a classic scrollbar appearing does not narrow the rows under the header.
      className="justable:min-h-0 justable:flex-1 justable:overflow-auto justable:[scrollbar-gutter:stable]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFloorClick?.();
      }}
    >
      {leadingRows.map((render, i) => (
        <Fragment key={i}>{render(2 + i)}</Fragment>
      ))}
      {showRows && (
        // `presentation`: a rowgroup inside the scroller's rowgroup is not a shape ARIA has.
        <div
          ref={canvasRef}
          role="presentation"
          className={box ? 'justable:relative' : undefined}
          style={box ? { height: total * box.rowHeight } : undefined}
        >
          {drawn}
        </div>
      )}
    </div>
  );

  return (
    <div
      role="grid"
      // Where a consumer binds the `--table-*` colours, so they resolve in the table's own scope.
      data-table
      className={classNames(
        'justable:flex justable:min-h-0 justable:flex-col',
        fill ? 'justable:flex-1' : 'justable:shrink-0',
        disabled && 'justable:pointer-events-none justable:opacity-50',
      )}
      aria-disabled={disabled || undefined}
      aria-label={label}
      tabIndex={0}
      // Never an id no element has: removed while the focused row is outside the window.
      aria-activedescendant={
        focus !== null && focus >= rowWindow.start && focus < rowWindow.end
          ? rowId(focus)
          : undefined
      }
      aria-multiselectable
      aria-rowcount={firstDataRow - 1 + total}
      aria-colcount={colCount}
    >
      {/* The header lane: `clip`, not `hidden` — `hidden` forces the other axis to `auto`. */}
      <div role="rowgroup" ref={laneRef} className="justable:shrink-0 justable:[overflow-x:clip]">
        <div ref={laneInnerRef}>{header}</div>
      </div>
      {wrapScroller ? wrapScroller(scroller) : scroller}
    </div>
  );
}
