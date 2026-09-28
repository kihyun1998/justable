/**
 * The header row: one `columnheader` per drawn column, each a sort target with a resize handle on its
 * right border.
 */
import { ArrowDown, ArrowUp } from 'lucide-react';

import { useContext } from 'react';
import type { CSSProperties } from 'react';

import { type ResizeDrag, useColumnResize } from '../hooks/useColumnResize.js';
import { classNames } from '../lib/classNames.js';
import { TABLE_GRID } from '../lib/tableClasses.js';
import type { HeaderColumn, TableSort } from '../types.js';
import { GridScrollerContext } from './gridScroller.js';

export interface TableHeaderProps<K extends string> {
  columns: readonly HeaderColumn<K>[];
  sort: TableSort<K> | undefined;
  gridStyle: CSSProperties;
  onSort: (key: K) => void;
  /** The dragged width in table px, unclamped — the consumer's model clamps it. */
  onResize: (key: K, px: number) => void;
  /**
   * Each move of a running border drag, with the grid's scroller, then `null` when it ends. The engine
   * never scrolls for a drag: `docs/map/territory/column-resize.md`.
   */
  onResizeDrag?: (drag: ResizeDrag | null) => void;
  /** A handle's double-click. Without it the double-click does nothing. */
  onAutoFit?: (key: K) => void;
  /** The handles' accessible name. */
  resizeLabel: string;
  /** Screen px per table px, for a scaled copy of the table. */
  scale?: number;
  /** Whether a press on a handle must not start a resize — the consumer's rule; the engine has none. */
  refusePress: (event: React.MouseEvent) => boolean;
  className?: string;
}

/**
 * The hover fill: a layer behind the content, shown under a hover-capable pointer and never on a
 * disabled button. Why a layer: `docs/map/territory/header-row.md`.
 */
const HOVER_LAYER = classNames(
  "justable:after:pointer-events-none justable:after:absolute justable:after:inset-0 justable:after:-z-1 justable:after:rounded-[inherit] justable:after:content-['']",
  'justable:after:bg-(--table-hover) justable:after:opacity-0 justable:after:transition-opacity justable:after:duration-120 justable:after:ease-[ease]',
  'justable:hover:enabled:after:opacity-100',
);

export function TableHeader<K extends string>({
  columns,
  sort,
  gridStyle,
  onSort,
  onResize,
  onResizeDrag,
  onAutoFit,
  resizeLabel,
  scale = 1,
  refusePress,
  className,
}: TableHeaderProps<K>) {
  const { resizing, begin } = useColumnResize(onResize, onResizeDrag);
  const grid = useContext(GridScrollerContext);

  const startResize = (column: HeaderColumn<K>) => (e: React.MouseEvent) => {
    // Suppressed for every button before `refusePress` decides, deliberately:
    // `docs/map/territory/column-resize.md`.
    e.preventDefault();
    e.stopPropagation();
    if (refusePress(e)) return;
    begin(column.key, column.width, e.clientX, scale, grid?.scrollerRef.current ?? null, grid?.holdWidth);
  };

  return (
    <div
      role="row"
      aria-rowindex={1}
      // `relative z-20` over its own surface: `docs/map/territory/header-row.md`.
      className={classNames(
        TABLE_GRID,
        'justable:relative justable:z-20 justable:flex-none justable:border-b justable:border-(--table-border) justable:bg-(--table-header-bg)',
        className,
      )}
      style={gridStyle}
      data-table-header
    >
      {columns.map((column, i) => (
        <div
          key={column.key}
          role="columnheader"
          aria-colindex={i + 1}
          aria-sort={
            sort?.key === column.key ? (sort.desc ? 'descending' : 'ascending') : undefined
          }
          // `self-stretch` is deliberate: `docs/map/territory/header-row.md`.
          className="justable:relative justable:flex justable:min-w-0 justable:items-center justable:self-stretch"
        >
          {/* The handle straddles this column's right border. */}
          <div
            data-table-resize={column.key}
            role="separator"
            aria-orientation="vertical"
            aria-label={resizeLabel}
            onMouseDown={startResize(column)}
            onDoubleClick={onAutoFit ? () => onAutoFit(column.key) : undefined}
            className="justable:group justable:absolute justable:-right-1.5 justable:top-0 justable:z-10 justable:h-full justable:w-3 justable:cursor-col-resize"
          >
            {/* The drawn line; how it shows: `docs/map/territory/column-resize.md`. */}
            <span
              aria-hidden
              className={classNames(
                'justable:pointer-events-none justable:absolute justable:left-1/2 justable:top-1.5 justable:bottom-1.5 justable:w-px justable:-translate-x-1/2',
                'justable:transition-colors',
                resizing === column.key
                  ? 'justable:bg-(--table-resize-line-active)'
                  : 'justable:bg-(--table-resize-line) justable:group-hover:bg-(--table-resize-line-hover)',
              )}
            />
          </div>
          {/* The whole cell is the sort target. */}
          <button
            type="button"
            onClick={() => onSort(column.key)}
            aria-label={column.label}
            className={classNames(
              'justable:relative justable:isolate justable:flex justable:h-full justable:w-full justable:min-w-0 justable:items-center justable:gap-1 justable:rounded justable:px-2 justable:text-left',
              // A browser's button styles, undone: `docs/map/territory/header-row.md`.
              'justable:m-0 justable:border-0 justable:bg-transparent justable:py-0 justable:[font-family:inherit] justable:text-[length:inherit] justable:leading-[inherit]',
              'justable:font-medium justable:text-(--table-header-ink) justable:focus-visible:outline-none justable:focus-visible:ring-1',
              'justable:focus-visible:ring-(--table-focus-ring)',
              HOVER_LAYER,
            )}
          >
            <span className="justable:truncate">{column.label}</span>
            {sort?.key === column.key &&
              (sort.desc ? (
                <ArrowDown className="justable:size-3 justable:shrink-0" />
              ) : (
                <ArrowUp className="justable:size-3 justable:shrink-0" />
              ))}
          </button>
        </div>
      ))}
    </div>
  );
}
