// @vitest-environment jsdom
/**
 * The windowed grid's semantics, against rows of its own. jsdom has no layout, so
 * the window is the unmeasured cap unless a case stubs the viewport's height.
 */
import { cleanup, render } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type RowPlace,
  TableGrid,
  type TableGridProps,
} from './TableGrid.js';
import { UNMEASURED_ROWS } from '../lib/rowWindow.js';

afterEach(cleanup);

const HEADER = <div role="row" aria-rowindex={1} data-fake-header />;

function renderGrid(over: Partial<TableGridProps> & { rows?: readonly string[] } = {}) {
  const rows = over.rows ?? ['a', 'b', 'c'];
  const { container } = render(
    <TableGrid
      label="Things"
      header={HEADER}
      colCount={2}
      total={rows.length}
      rowKey={(i) => rows[i]!}
      renderRow={(i: number, place: RowPlace) => (
        <div
          role="row"
          id={place.id}
          aria-rowindex={place.rowIndex}
          data-row={rows[i]}
          data-focused={place.focused || undefined}
        />
      )}
      fill
      focus={null}
      rowIdPrefix="t"
      rowHeightRem={1.75}
      {...over}
    />,
  );
  return container.querySelector('[role="grid"]') as HTMLElement;
}

const dataRows = (grid: HTMLElement) => [...grid.querySelectorAll('[data-row]')];

describe('TableGrid', () => {
  it('is a named, focusable grid', () => {
    const grid = renderGrid();
    expect(grid.getAttribute('aria-label')).toBe('Things');
    expect(grid.tabIndex).toBe(0);
    expect(grid.getAttribute('aria-colcount')).toBe('2');
  });

  it('⚠️ says it is multi-selectable only when the consumer says so', () => {
    expect(renderGrid().hasAttribute('aria-multiselectable')).toBe(false);
    cleanup();
    expect(renderGrid({ multiselectable: false }).hasAttribute('aria-multiselectable')).toBe(false);
    cleanup();
    expect(renderGrid({ multiselectable: true }).getAttribute('aria-multiselectable')).toBe('true');
  });

  it('numbers data rows from 2, after the header', () => {
    expect(dataRows(renderGrid()).map((r) => r.getAttribute('aria-rowindex'))).toEqual([
      '2',
      '3',
      '4',
    ]);
  });

  it('leading rows take the positions after the header and push the data down', () => {
    const grid = renderGrid({
      leadingRows: [
        (i) => <div role="row" aria-rowindex={i} data-lead="up" />,
        (i) => <div role="row" aria-rowindex={i} data-lead="new" />,
      ],
    });
    expect(
      [...grid.querySelectorAll('[data-lead]')].map((r) => r.getAttribute('aria-rowindex')),
    ).toEqual(['2', '3']);
    expect(dataRows(grid)[0]!.getAttribute('aria-rowindex')).toBe('4');
    expect(grid.getAttribute('aria-rowcount')).toBe('6');
  });

  it('⚠️ announces the total, not the rows in the DOM', () => {
    const rows = Array.from({ length: UNMEASURED_ROWS + 50 }, (_, i) => `r${i}`);
    const grid = renderGrid({ rows });
    expect(dataRows(grid)).toHaveLength(UNMEASURED_ROWS);
    expect(grid.getAttribute('aria-rowcount')).toBe(String(rows.length + 1));
  });

  it('names the focused row, and only while it is drawn', () => {
    expect(renderGrid({ focus: 1 }).getAttribute('aria-activedescendant')).toBe('t-row-1');
    cleanup();
    const rows = Array.from({ length: UNMEASURED_ROWS + 50 }, (_, i) => `r${i}`);
    expect(
      renderGrid({ rows, focus: UNMEASURED_ROWS + 10 }).hasAttribute('aria-activedescendant'),
    ).toBe(false);
  });

  it('⚠️ names no row while no data rows are drawn, whatever the focus', () => {
    const grid = renderGrid({ showRows: false, focus: 1 });
    expect(dataRows(grid)).toHaveLength(0);
    expect(grid.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('draws no data rows when told not to, but keeps the leading ones', () => {
    const grid = renderGrid({
      showRows: false,
      leadingRows: [(i) => <div role="row" aria-rowindex={i} data-lead />],
    });
    expect(dataRows(grid)).toHaveLength(0);
    expect(grid.querySelector('[data-lead]')).not.toBeNull();
  });

  it('a press on the floor, not on a row, reports it', () => {
    const onFloorClick = vi.fn();
    const grid = renderGrid({ onFloorClick });
    const scroller = grid.querySelectorAll('[role="rowgroup"]')[1] as HTMLElement;
    dataRows(grid)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFloorClick).not.toHaveBeenCalled();
    scroller.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onFloorClick).toHaveBeenCalledTimes(1);
  });

  it('a disabled grid says so and dies to the pointer by class', () => {
    const grid = renderGrid({ disabled: true });
    expect(grid.getAttribute('aria-disabled')).toBe('true');
    expect(grid.className.split(' ')).toContain('justable:pointer-events-none');
  });

  it('carries the consumer’s scroller attributes', () => {
    const grid = renderGrid({ scrollerProps: { 'data-mine': true } });
    expect(grid.querySelector('[data-mine]')?.getAttribute('role')).toBe('rowgroup');
  });

  it('⚠️ keys rows by identity, so a re-sort moves a row’s DOM with it', () => {
    const { container, rerender } = render(<Keyed rows={['a', 'b']} />);
    const a = container.querySelector('[data-row="a"]');
    rerender(<Keyed rows={['b', 'a']} />);
    expect(container.querySelector('[data-row="a"]')).toBe(a);
  });
});

function Keyed({ rows }: { rows: string[] }) {
  return (
    <TableGrid
      label="k"
      header={HEADER}
      colCount={1}
      total={rows.length}
      rowKey={(i) => rows[i]!}
      renderRow={(i) => <div role="row" data-row={rows[i]} />}
      fill
      focus={null}
      rowIdPrefix="k"
      rowHeightRem={1.75}
    />
  );
}

describe('the keyboard link', () => {
  /** jsdom lays nothing out; a viewport height is what lets the grid measure at all. */
  function withViewport(height: number, run: () => void) {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => height,
    });
    try {
      run();
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientHeight', original);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  }

  it('is told how many whole rows the measured viewport shows', () => {
    const link = { rowsPerPage: 0 };
    withViewport(10 * 1.75 * 16 + 5, () => {
      renderGrid({ keyboard: link, rows: Array.from({ length: 40 }, (_, i) => `r${i}`) });
    });
    // No row has a measured box in jsdom, so the height falls back to `rowHeightRem` at 16px.
    expect(link.rowsPerPage).toBe(10);
  });

  it('is left alone while nothing has been measured', () => {
    const link = { rowsPerPage: 0 };
    renderGrid({ keyboard: link });
    expect(link.rowsPerPage).toBe(0);
  });
});

describe('the row height the grid measures', () => {
  /**
   * jsdom lays nothing out, so the scroller's `clientHeight` and `offsetHeight` are what let the
   * grid measure at all, while a row's height is whatever style the case gives it. `rowScreen` is
   * the row's height on screen, read in turn from the list: a case can set one that disagrees with
   * the row's layout height, or two that alternate at every measurement.
   */
  function measured(scrollerScreen: number, rowScreen: readonly number[], run: () => void) {
    const proto = HTMLElement.prototype;
    const rect = proto.getBoundingClientRect;
    const client = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    const offset = Object.getOwnPropertyDescriptor(proto, 'offsetHeight');
    const isScroller = (el: HTMLElement) => el.hasAttribute('data-scroller');
    let reads = 0;
    proto.getBoundingClientRect = function (this: HTMLElement) {
      const height = isScroller(this)
        ? scrollerScreen
        : this.hasAttribute('data-row')
          ? rowScreen[reads++ % rowScreen.length]!
          : 0;
      return { width: 0, height, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, toJSON: () => ({}) };
    };
    for (const name of ['clientHeight', 'offsetHeight'] as const) {
      Object.defineProperty(proto, name, {
        configurable: true,
        get(this: HTMLElement) {
          return isScroller(this) ? 654 : 0;
        },
      });
    }
    try {
      run();
    } finally {
      proto.getBoundingClientRect = rect;
      for (const [name, original] of [['clientHeight', client], ['offsetHeight', offset]] as const) {
        if (original) Object.defineProperty(proto, name, original);
        else delete (proto as unknown as Record<string, unknown>)[name];
      }
    }
  }

  const tops = (grid: HTMLElement) =>
    dataRows(grid)
      .slice(0, 3)
      .map((r) => (r as HTMLElement).style.top);

  /** 40 rows styled as the case asks, inside a scroller 654 layout px tall. */
  function styledGrid(style: CSSProperties, rowScreen: readonly number[], scrollerScreen = 327) {
    const link = { rowsPerPage: 0 };
    let grid!: HTMLElement;
    measured(scrollerScreen, rowScreen, () => {
      grid = renderGrid({
        keyboard: link,
        rows: Array.from({ length: 40 }, (_, i) => `r${i}`),
        renderRow: (i: number, place: RowPlace) => (
          <div role="row" data-row={`r${i}`} style={{ ...place.style, ...style }} />
        ),
        scrollerProps: { 'data-scroller': true },
      });
    });
    return { grid, link };
  }

  it('places rows by the row’s own height, not by its height on screen', () => {
    // 20 on screen over the scroller's ratio (327/654) would be 40; the row's height is 30.
    const { grid, link } = styledGrid({ height: 30 }, [20]);
    expect(tops(grid)).toEqual(['0px', '30px', '60px']);
    expect(link.rowsPerPage).toBe(Math.floor(654 / 30));
  });

  /** ⚠️ The padding and borders are summed only for `content-box`: `docs/map/territory/row-windowing.md`. */
  it('⚠️ adds a content-box row’s padding and borders to its height, and a border-box row’s not', () => {
    const contentBox = styledGrid(
      {
        boxSizing: 'content-box',
        height: 24,
        paddingTop: 1,
        paddingBottom: 1,
        borderTop: '1px solid black',
        borderBottom: '1px solid black',
      },
      [20],
    );
    expect(tops(contentBox.grid)).toEqual(['0px', '28px', '56px']);
    cleanup();
    const borderBox = styledGrid(
      {
        boxSizing: 'border-box',
        height: 28,
        paddingTop: 1,
        paddingBottom: 1,
        borderBottom: '1px solid black',
      },
      [20],
    );
    expect(tops(borderBox.grid)).toEqual(['0px', '28px', '56px']);
  });

  it('⚠️ leaves the `rowHeightRem` fallback alone where the row has no readable height', () => {
    const { grid, link } = styledGrid({}, [15]);
    expect(tops(grid)).toEqual(['0px', '28px', '56px']);
    expect(link.rowsPerPage).toBe(Math.floor(654 / 28));
  });

  /** ⚠️ A height that is not positive is no measurement: `docs/map/invariant/zero-is-no-measurement.md`. */
  it('⚠️ falls back for a row of no height, rather than reading its borders as one', () => {
    const { grid } = styledGrid(
      { boxSizing: 'content-box', height: 0, borderTop: '1px solid black', borderBottom: '1px solid black' },
      [15],
    );
    expect(tops(grid)).toEqual(['0px', '28px', '56px']);
  });

  /** ⚠️ The row height does not wobble, so the comparison is strict: `docs/map/territory/row-windowing.md`. */
  it('⚠️ settles where the row’s height on screen alternates at every measurement', () => {
    // Half the two readings `scale(0.83)` gave once divided: `docs/map/territory/row-windowing.md`.
    const { grid } = styledGrid({ height: 28 }, [14.000013, 13.999994]);
    expect(tops(grid)).toEqual(['0px', '28px', '56px']);
  });

  it('is the same whatever height the scroller has on screen', () => {
    const { grid, link } = styledGrid({ height: 30 }, [20], 0);
    expect(tops(grid)).toEqual(['0px', '30px', '60px']);
    expect(link.rowsPerPage).toBe(Math.floor(654 / 30));
  });
});

describe('revealing the focused row below leading rows', () => {
  /**
   * A 280px viewport whose canvas starts `canvasTop` px down its content: jsdom lays nothing out, so
   * the scroller's and the canvas's client boxes are stubbed, unscaled.
   */
  let canvasTop = 28;
  /** Added to every second reading of the canvas's top, as a scaled grid's reading wobbles. */
  let jitter = 0;
  let reads = 0;
  function laidOut(run: () => void) {
    const proto = HTMLElement.prototype;
    const rect = proto.getBoundingClientRect;
    const client = Object.getOwnPropertyDescriptor(proto, 'clientHeight');
    const isScroller = (el: HTMLElement) => el.hasAttribute('data-scroller');
    proto.getBoundingClientRect = function (this: HTMLElement) {
      const isCanvas = this.getAttribute('role') === 'presentation' && isScroller(this.parentElement!);
      // The canvas's client top is its offset less the scroll, as a browser reports it.
      const top = isCanvas ? canvasTop + (reads++ % 2) * jitter - this.parentElement!.scrollTop : 0;
      const height = isScroller(this) ? 280 : 0;
      return { width: 0, height, x: 0, y: top, top, left: 0, right: 0, bottom: top + height, toJSON: () => ({}) };
    };
    Object.defineProperty(proto, 'clientHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return isScroller(this) ? 280 : 0;
      },
    });
    try {
      run();
    } finally {
      proto.getBoundingClientRect = rect;
      if (client) Object.defineProperty(proto, 'clientHeight', client);
      else delete (proto as unknown as Record<string, unknown>).clientHeight;
    }
  }

  const rows = Array.from({ length: 40 }, (_, i) => `r${i}`);
  const grid = (focus: number | null) => (
    <TableGrid
      label="Things"
      header={HEADER}
      colCount={1}
      total={rows.length}
      rowKey={(i) => rows[i]!}
      renderRow={(i: number, place: RowPlace) => (
        <div role="row" id={place.id} aria-rowindex={place.rowIndex} data-row={rows[i]} style={place.style} />
      )}
      leadingRows={[(i) => <div role="row" aria-rowindex={i} data-lead />]}
      fill
      focus={focus}
      rowIdPrefix="t"
      rowHeightRem={1.75}
      scrollerProps={{ 'data-scroller': true }}
    />
  );
  const scrollerOf = (container: HTMLElement) =>
    container.querySelector('[data-scroller]') as HTMLElement;

  afterEach(() => {
    canvasTop = 28;
    jitter = 0;
    reads = 0;
  });

  it('brings the last row’s bottom to the viewport’s bottom, past the leading rows', () => {
    laidOut(() => {
      const { container } = render(grid(39));
      // No row has a measured box in jsdom, so a row is the `rowHeightRem` fallback, 28px.
      expect(scrollerOf(container).scrollTop).toBe(28 + 40 * 28 - 280);
    });
  });

  /** ⚠️ A sub-px move of the offset is no change: `docs/map/territory/row-windowing.md`. */
  it('settles when the offset reads differently by less than a px at each measurement', () => {
    jitter = 0.4;
    laidOut(() => {
      const { container } = render(grid(39));
      expect(scrollerOf(container).scrollTop).toBe(28 + 40 * 28 - 280);
    });
  });

  /** ⚠️ The offset alone does not reveal: `docs/map/territory/row-windowing.md`. */
  it('leaves a list scrolled away where it is when a leading row appears', () => {
    laidOut(() => {
      const { container, rerender } = render(grid(39));
      const scroller = scrollerOf(container);
      scroller.scrollTop = 0;
      canvasTop = 56;
      rerender(grid(39));
      expect(scroller.scrollTop).toBe(0);
      // The next move is revealed from the new offset.
      rerender(grid(38));
      expect(scroller.scrollTop).toBe(56 + 39 * 28 - 280);
    });
  });
});
