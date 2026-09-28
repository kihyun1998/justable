// @vitest-environment jsdom
/**
 * The windowed grid's semantics, against rows of its own. jsdom has no layout, so
 * the window is the unmeasured cap unless a case stubs the viewport's height.
 */
import { cleanup, render } from '@testing-library/react';
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
