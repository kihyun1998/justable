/**
 * A windowed `role="grid"`: a non-scrolling header lane over a native scroller that draws only the
 * rows the viewport can see. One focusable container; rows carry no `tabIndex`, and the focused row
 * is named by `aria-activedescendant`.
 */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { type MarqueeOptions, useMarquee } from '../hooks/useMarquee.js';
import type { TableKeyboardLink } from '../hooks/useTableKeyboard.js';
import { classNames } from '../lib/classNames.js';
import { scrollToReveal, visibleRange } from '../lib/rowWindow.js';
import { type GridScroller, GridScrollerContext } from './gridScroller.js';

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
  /** Dead to every pointer gesture. */
  disabled?: boolean;
  /** Whether the consumer lets several rows be selected at once; the engine selects nothing. */
  multiselectable?: boolean;
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
  /** A rectangle dragged over the rows, reporting the rows it touches; absent, there is none. */
  marquee?: MarqueeOptions;
}

/** The `aria-rowindex` of the first row after the header: `docs/map/invariant/row-one-is-the-header.md`. */
const FIRST_BODY_ROW = 2;

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
  multiselectable = false,
  rowHeightRem,
  keyboard,
  onFloorClick,
  wrapScroller,
  scrollerProps,
  marquee,
}: TableGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const laneInnerRef = useRef<HTMLDivElement>(null);
  // Read through a ref by the observer attached once: `docs/map/territory/row-windowing.md`.
  const rowHeightRemRef = useRef(rowHeightRem);
  rowHeightRemRef.current = rowHeightRem;

  // Scroll and size are separate state, deliberately: `docs/map/territory/row-windowing.md`.
  const [scrollTop, setScrollTop] = useState(0);
  const [box, setBox] = useState<{ viewportHeight: number; rowHeight: number } | null>(null);

  const measureBox = () => {
    const el = scrollerRef.current;
    if (!el) return;

    // The lane's gutter, written by hand and never by React: `docs/map/territory/header-lane.md`.
    const lane = laneRef.current;
    if (lane) lane.style.paddingRight = `${el.offsetWidth - el.clientWidth}px`;

    // A zero viewport is no measurement: `docs/map/invariant/zero-is-no-measurement.md`.
    if (el.clientHeight <= 0) return;
    const first = canvasRef.current?.firstElementChild;
    const row = first === marqueeRef.current ? null : first;
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
    // Attached once, deliberately: `docs/map/territory/row-windowing.md`.
  }, []);

  // Bring the focused row back into view.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !box || focus === null) return;
    // Reads the offset from the element, not from state, deliberately:
    // `docs/map/territory/row-windowing.md`.
    const next = scrollToReveal(focus, { scrollTop: el.scrollTop, ...box });
    if (next !== null) el.scrollTop = next;
  }, [focus, box]);

  useEffect(() => {
    if (box && keyboard) keyboard.rowsPerPage = Math.floor(box.viewportHeight / box.rowHeight);
  }, [box, keyboard]);

  const marqueeDrag = useMarquee(
    marquee,
    { grid: gridRef, scroller: scrollerRef, canvas: canvasRef, rectangle: marqueeRef },
    box && showRows ? { rowHeight: box.rowHeight, total } : null,
  );

  // No box is no measurement, which `visibleRange` answers for itself:
  // `docs/map/invariant/zero-is-no-measurement.md`.
  const rowWindow = visibleRange({ scrollTop, viewportHeight: 0, rowHeight: 0, ...box, total });
  const rowId = (index: number) => `${rowIdPrefix}-row-${index}`;
  const firstDataRow = FIRST_BODY_ROW + leadingRows.length;

  const drawn: ReactNode[] = [];
  if (showRows) {
    for (let index = rowWindow.start; index < rowWindow.end; index += 1) {
      drawn.push(
        <Fragment key={rowKey(index)}>
          {renderRow(index, {
            id: rowId(index),
            rowIndex: firstDataRow + index,
            focused: focus === index,
            // `right: 0` as well as `left` is deliberate:
            // `docs/map/invariant/drawn-columns-are-tracks-are-cells.md`.
            style: box
              ? { position: 'absolute', top: index * box.rowHeight, left: 0, right: 0 }
              : undefined,
          })}
        </Fragment>,
      );
    }
  }

  // The content never narrows during a border drag: `docs/map/territory/column-resize.md`.
  const gridScroller = useMemo<GridScroller>(
    () => ({
      scrollerRef,
      holdWidth: (on) => {
        const canvas = canvasRef.current;
        const el = scrollerRef.current;
        if (!canvas || !el) return;
        canvas.style.minWidth = on
          ? `${Math.max(Number.parseFloat(canvas.style.minWidth) || 0, el.scrollWidth)}px`
          : '';
      },
    }),
    [],
  );

  const scroller = (
    <div
      role="rowgroup"
      ref={scrollerRef}
      {...scrollerProps}
      onScroll={(e) => {
        setScrollTop(e.currentTarget.scrollTop);
        // Horizontal follows in the DOM directly, not through state:
        // `docs/map/territory/header-lane.md`.
        const inner = laneInnerRef.current;
        if (inner) inner.style.transform = `translateX(${-e.currentTarget.scrollLeft}px)`;
      }}
      // `scrollbar-gutter: stable`: `docs/map/territory/header-lane.md`.
      className="justable:min-h-0 justable:flex-1 justable:overflow-auto justable:[scrollbar-gutter:stable]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFloorClick?.();
      }}
      onMouseDown={marquee ? marqueeDrag.onMouseDown : undefined}
    >
      {leadingRows.map((render, i) => (
        <Fragment key={i}>{render(FIRST_BODY_ROW + i)}</Fragment>
      ))}
      {showRows && (
        // `presentation` is deliberate: `docs/map/territory/grid-scaffold.md`.
        <div
          ref={canvasRef}
          role="presentation"
          className={box ? 'justable:relative' : undefined}
          style={box ? { height: total * box.rowHeight } : undefined}
        >
          {drawn}
          {marquee && box && (
            <div
              ref={marqueeRef}
              aria-hidden
              data-table-marquee
              className="justable:pointer-events-none justable:absolute justable:hidden justable:border justable:border-(--table-marquee-border) justable:bg-(--table-marquee-fill)"
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={gridRef}
      role="grid"
      // Where a consumer binds the `--table-*` colours.
      data-table
      className={classNames(
        'justable:flex justable:min-h-0 justable:flex-col',
        fill ? 'justable:flex-1' : 'justable:shrink-0',
        disabled && 'justable:pointer-events-none justable:opacity-50',
      )}
      aria-disabled={disabled || undefined}
      aria-label={label}
      tabIndex={0}
      // Removed while the focused row is not drawn: `docs/map/territory/grid-scaffold.md`.
      aria-activedescendant={
        showRows && focus !== null && focus >= rowWindow.start && focus < rowWindow.end
          ? rowId(focus)
          : undefined
      }
      aria-multiselectable={multiselectable || undefined}
      aria-rowcount={firstDataRow - 1 + total}
      aria-colcount={colCount}
    >
      {/* The header lane: `clip`, not `hidden`, deliberately:
          `docs/map/territory/header-lane.md`. */}
      <div role="rowgroup" ref={laneRef} className="justable:shrink-0 justable:[overflow-x:clip]">
        <div ref={laneInnerRef}>
          <GridScrollerContext.Provider value={gridScroller}>{header}</GridScrollerContext.Provider>
        </div>
      </div>
      {wrapScroller ? wrapScroller(scroller) : scroller}
    </div>
  );
}
