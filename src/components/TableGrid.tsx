/**
 * A windowed `role="grid"`: a non-scrolling header lane over a native scroller that draws only the
 * rows the viewport can see. One focusable container; rows carry no `tabIndex`, and the focused row
 * is named by `aria-activedescendant`.
 */
import { Fragment, useRef } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { useHeaderLane } from '../hooks/useHeaderLane.js';
import { type MarqueeOptions, useMarquee } from '../hooks/useMarquee.js';
import { useRowWindow } from '../hooks/useRowWindow.js';
import type { TableKeyboardLink } from '../hooks/useTableKeyboard.js';
import { classNames } from '../lib/classNames.js';
import { GridScrollerContext } from './gridScroller.js';

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
  /**
   * A row's height in `rem`, used before a drawn row is measured and while that row has no height of
   * its own.
   */
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
  // Called before `useHeaderLane`, deliberately: `docs/map/territory/header-lane.md`.
  const rows = useRowWindow({
    scrollerRef,
    canvasRef,
    notARowRef: marqueeRef,
    total,
    focus,
    rowHeightRem,
    keyboard,
  });
  const { box, range: rowWindow } = rows;
  const lane = useHeaderLane({ scrollerRef, canvasRef, remeasure: rows.measure });

  const marqueeDrag = useMarquee(
    marquee,
    { grid: gridRef, scroller: scrollerRef, canvas: canvasRef, rectangle: marqueeRef },
    box && showRows ? { rowHeight: box.rowHeight, total } : null,
  );

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
            style: rows.place(index),
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
        rows.onScroll(e.currentTarget.scrollTop);
        lane.onScroll(e.currentTarget.scrollLeft);
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
      <div
        ref={lane.spacerRef}
        aria-hidden
        className="justable:pointer-events-none justable:invisible justable:hidden justable:-mt-px justable:h-px"
      />
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
      <div role="rowgroup" ref={lane.laneRef} className="justable:shrink-0 justable:[overflow-x:clip]">
        <div ref={lane.laneInnerRef}>
          <GridScrollerContext.Provider value={lane.gridScroller}>{header}</GridScrollerContext.Provider>
        </div>
      </div>
      {wrapScroller ? wrapScroller(scroller) : scroller}
    </div>
  );
}
