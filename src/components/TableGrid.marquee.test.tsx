// @vitest-environment jsdom
/**
 * The grid's marquee, driven the way a browser drives it: a press on the scroller, then moves,
 * scrolls and the release on `document`. jsdom lays nothing out, so each case stubs a 300×200
 * viewport, rows fall back to `rowHeightRem` (28px), and the canvas sits at the scroller's top left.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TableGrid, type TableGridProps } from './TableGrid.js';

const VIEW = { width: 300, height: 200 };
const ROW = 28;
let restore: (() => void)[] = [];

function stub(name: 'clientHeight' | 'clientWidth', value: number) {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
  Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => value });
  restore.push(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, name, original);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
  });
}

beforeEach(() => {
  stub('clientHeight', VIEW.height);
  stub('clientWidth', VIEW.width);
});

afterEach(() => {
  cleanup();
  for (const undo of restore.reverse()) undo();
  restore = [];
});

type Marquee = NonNullable<TableGridProps['marquee']>;

function renderGrid(
  over: Partial<Marquee> = {},
  props: Partial<TableGridProps> = {},
  total = 40,
) {
  const onMarquee = vi.fn();
  const onFloorClick = vi.fn();
  const rowClick = vi.fn();
  const rowDoubleClick = vi.fn();
  const marquee: Marquee = { refusePress: () => false, threshold: 4, onMarquee, ...over };
  const view = render(
    <TableGrid
      label="Things"
      header={<div role="row" aria-rowindex={1} />}
      colCount={1}
      total={total}
      rowKey={String}
      renderRow={(i, place) => (
        <div
          role="row"
          id={place.id}
          data-row={i}
          style={place.style}
          onClick={rowClick}
          onDoubleClick={rowDoubleClick}
        />
      )}
      fill
      focus={null}
      rowIdPrefix="m"
      rowHeightRem={ROW / 16}
      onFloorClick={onFloorClick}
      marquee={marquee}
      {...props}
    />,
  );
  const grid = view.container.querySelector('[role="grid"]') as HTMLElement;
  const scroller = grid.querySelectorAll(':scope > [role="rowgroup"]')[1] as HTMLElement;
  return { ...view, grid, scroller, onMarquee, onFloorClick, rowClick, rowDoubleClick };
}

const press = (target: HTMLElement, x: number, y: number, init: MouseEventInit = {}) =>
  fireEvent.mouseDown(target, { button: 0, clientX: x, clientY: y, ...init });
/** A move with the primary button still held, as a browser sends during a drag. */
const moveTo = (x: number, y: number, init: MouseEventInit = {}) =>
  act(() => {
    fireEvent.mouseMove(document, { clientX: x, clientY: y, buttons: 1, ...init });
  });
const release = (button = 0) =>
  act(() => {
    fireEvent.mouseUp(document, { button });
  });
/** The browser's click after a release, sent to where the press and release met. */
const clickAfter = (target: HTMLElement) => fireEvent.click(target, { detail: 1 });

/** Each report as `[phase, range]`. */
const reports = (onMarquee: ReturnType<typeof vi.fn>) =>
  onMarquee.mock.calls.map(([m]) => [m.phase, m.range]);

describe('a marquee', () => {
  it('reports the rows it crosses, from the press to the release', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(20, 40);
    moveTo(20, 100);
    release();
    expect(reports(onMarquee)).toEqual([
      ['start', { anchor: 1, head: 1 }],
      ['move', { anchor: 1, head: 3 }],
      ['end', { anchor: 1, head: 3 }],
    ]);
  });
});

describe('the threshold', () => {
  it('is required, as the press predicate is', () => {
    // Never called: `pnpm typecheck` is what runs these lines.
    const unwritten = (): NonNullable<TableGridProps['marquee']>[] => [
      // @ts-expect-error: the threshold has no default.
      { refusePress: () => false, onMarquee: () => {} },
      // @ts-expect-error: the press predicate has no default.
      { threshold: 4, onMarquee: () => {} },
    ];
    expect(unwritten).toBeTypeOf('function');
  });

  it('a press that moves no further than the threshold reports nothing, and its click goes through', () => {
    const { scroller, onMarquee, onFloorClick } = renderGrid({ threshold: 4 });
    press(scroller, 10, 30);
    moveTo(14, 26);
    release();
    clickAfter(scroller);
    expect(onMarquee).not.toHaveBeenCalled();
    expect(onFloorClick).toHaveBeenCalledTimes(1);
  });

  it('one px past the threshold on either axis starts it', () => {
    const { scroller, onMarquee } = renderGrid({ threshold: 4 });
    press(scroller, 10, 30);
    moveTo(10, 35);
    expect(reports(onMarquee)).toEqual([['start', { anchor: 1, head: 1 }]]);
  });

  it('⚠️ the click a browser sends after a marquee reaches neither the floor nor a row', () => {
    const { scroller, onFloorClick, rowClick } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    release();
    clickAfter(scroller);
    expect(onFloorClick).not.toHaveBeenCalled();
    const row = scroller.querySelector('[data-row="2"]') as HTMLElement;
    press(row, 10, 60);
    moveTo(10, 120);
    release();
    clickAfter(row);
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('only that one click: the next is the consumer’s again', () => {
    const { scroller, onFloorClick } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    release();
    clickAfter(scroller);
    clickAfter(scroller);
    expect(onFloorClick).toHaveBeenCalledTimes(1);
  });

  it('⚠️ a drag pressed as a second click sends no double-click either', () => {
    // Measured in Chrome: a click, then a drag pressed within the double-click time, releases a
    // click with `detail` 2 and then a `dblclick` on the same row.
    const { scroller, rowDoubleClick } = renderGrid();
    const row = scroller.querySelector('[data-row="2"]') as HTMLElement;
    press(row, 10, 60, { detail: 2 });
    moveTo(60, 62);
    release();
    fireEvent.click(row, { detail: 2 });
    fireEvent.dblClick(row, { detail: 2 });
    expect(rowDoubleClick).not.toHaveBeenCalled();
  });

  it('a double-click with no drag behind it is the consumer’s', () => {
    const { scroller, rowDoubleClick } = renderGrid();
    const row = scroller.querySelector('[data-row="2"]') as HTMLElement;
    press(row, 10, 60, { detail: 2 });
    release();
    fireEvent.dblClick(row, { detail: 2 });
    expect(rowDoubleClick).toHaveBeenCalledTimes(1);
  });

  it('⚠️ a click no press made — a key’s — is not the release’s, and goes through', () => {
    const { scroller, onFloorClick } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    release();
    fireEvent.click(scroller, { detail: 0 });
    expect(onFloorClick).toHaveBeenCalledTimes(1);
  });

  it('⚠️ a release the browser sends no click for leaves the next press’s click alone', () => {
    const { scroller, onFloorClick } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    release();
    press(scroller, 10, 30);
    release();
    clickAfter(scroller);
    expect(onFloorClick).toHaveBeenCalledTimes(1);
  });
});

describe('which press arms a marquee', () => {
  it('a refused press reports nothing and keeps its default', () => {
    const refusePress = vi.fn((_: React.MouseEvent) => true);
    const { scroller, onMarquee } = renderGrid({ refusePress });
    const allowed = press(scroller, 10, 30);
    moveTo(10, 100);
    release();
    expect(refusePress).toHaveBeenCalledTimes(1);
    expect(refusePress.mock.calls[0]![0]).toMatchObject({ clientX: 10, clientY: 30 });
    expect(allowed).toBe(true);
    expect(onMarquee).not.toHaveBeenCalled();
  });

  it('an allowed press loses its default, so no text is selected, and focuses the grid', () => {
    const { grid, scroller } = renderGrid();
    const allowed = press(scroller, 10, 30);
    expect(allowed).toBe(false);
    expect(document.activeElement).toBe(grid);
  });

  it('⚠️ a press on the scrollbar is not the consumer’s to judge and starts nothing', () => {
    const refusePress = vi.fn(() => false);
    const { scroller, onMarquee } = renderGrid({ refusePress });
    press(scroller, VIEW.width + 5, 30);
    moveTo(VIEW.width - 50, 100);
    press(scroller, 10, VIEW.height + 5);
    moveTo(50, 100);
    expect(refusePress).not.toHaveBeenCalled();
    expect(onMarquee).not.toHaveBeenCalled();
  });

  it('a grid with no marquee attaches nothing and draws no rectangle', () => {
    const { scroller } = renderGrid({}, { marquee: undefined });
    expect(press(scroller, 10, 30)).toBe(true);
    expect(scroller.querySelector('[data-table-marquee]')).toBeNull();
  });

  it('a grid that has not measured its rows starts no marquee', () => {
    for (const undo of restore.reverse()) undo();
    restore = [];
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    expect(onMarquee).not.toHaveBeenCalled();
  });
});

describe('the range', () => {
  it('dragging up puts the head above the anchor', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 100);
    moveTo(10, 30);
    expect(onMarquee).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'start', range: { anchor: 3, head: 1 } }),
    );
  });

  it('a press on the floor touches nothing until the rectangle reaches the last row', () => {
    const { scroller, onMarquee } = renderGrid({}, {}, 3);
    press(scroller, 10, 150);
    moveTo(10, 100);
    moveTo(10, 70);
    expect(reports(onMarquee)).toEqual([
      ['start', null],
      ['move', { anchor: 2, head: 2 }],
    ]);
  });

  it('⚠️ is measured from the canvas, not the scroller, so leading rows do not shift it', () => {
    const { scroller, onMarquee } = renderGrid();
    const canvas = scroller.querySelector('[role="presentation"]') as HTMLElement;
    // A leading row 40px tall puts the canvas 40px down the scroller.
    canvas.getBoundingClientRect = () => ({ top: 40, left: 0 }) as DOMRect;
    press(scroller, 10, 45);
    moveTo(10, 100);
    expect(onMarquee).toHaveBeenLastCalledWith(
      expect.objectContaining({ range: { anchor: 0, head: 2 } }),
    );
  });

  it('⚠️ a scroll under a still pointer moves the range, and is reported', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 190);
    act(() => {
      scroller.scrollTop = 56;
      fireEvent.scroll(scroller);
    });
    expect(onMarquee).toHaveBeenLastCalledWith(
      expect.objectContaining({ phase: 'move', range: { anchor: 1, head: 8 } }),
    );
  });

  it('a scroll that moves no row border past the pointer reports nothing', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    const before = onMarquee.mock.calls.length;
    act(() => {
      scroller.scrollTop = 2;
      fireEvent.scroll(scroller);
    });
    expect(onMarquee).toHaveBeenCalledTimes(before);
  });

  it('⚠️ a pointer past the view counts at the view’s edge, so rows not scrolled into view are not touched', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 900);
    // The view is 200px tall: its bottom edge is in row 7.
    expect(onMarquee).toHaveBeenLastCalledWith(
      expect.objectContaining({ range: { anchor: 1, head: 7 } }),
    );
  });

  it('every report carries the latest mouse event and the scroller', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100, { ctrlKey: true });
    const report = onMarquee.mock.calls.at(-1)![0];
    expect(report.event.ctrlKey).toBe(true);
    expect(report.event.clientY).toBe(100);
    expect(report.scroller).toBe(scroller);
  });

  it('every pointer move is reported, even one that keeps the range, for the consumer’s edge scroll', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    moveTo(60, 101);
    expect(reports(onMarquee)).toEqual([
      ['start', { anchor: 1, head: 3 }],
      ['move', { anchor: 1, head: 3 }],
    ]);
  });
});

describe('the rectangle', () => {
  const rectangle = (scroller: HTMLElement) =>
    scroller.querySelector('[data-table-marquee]') as HTMLElement;
  const vertical = (scroller: HTMLElement) => {
    const { top, height } = rectangle(scroller).style;
    return { top, height };
  };

  it('is drawn from the press to the pointer on the canvas, and only while the marquee runs', () => {
    const { scroller } = renderGrid();
    const box = rectangle(scroller);
    expect(box.getAttribute('aria-hidden')).toBe('true');
    press(scroller, 50, 100);
    moveTo(52, 101);
    expect(box.style.display).toBe('');
    moveTo(20, 30);
    const { display, left, top, width, height } = box.style;
    expect({ display, left, top, width, height }).toEqual({
      display: 'block',
      left: '20px',
      top: '30px',
      width: '30px',
      height: '70px',
    });
    release();
    expect(box.style.display).toBe('');
  });

  it('keeps its press corner on the content while the scroller scrolls', () => {
    const { scroller } = renderGrid();
    Object.defineProperty(scroller, 'scrollHeight', { get: () => 40 * ROW });
    press(scroller, 50, 100);
    moveTo(80, 150);
    act(() => {
      scroller.scrollTop = 40;
      fireEvent.scroll(scroller);
    });
    expect(vertical(scroller)).toEqual({ top: '100px', height: '90px' });
  });

  it('⚠️ stays inside the scroller’s content, so it never makes more room to scroll into', () => {
    const { scroller } = renderGrid({}, {}, 3);
    Object.defineProperty(scroller, 'scrollHeight', { get: () => VIEW.height });
    Object.defineProperty(scroller, 'scrollWidth', { get: () => VIEW.width });
    press(scroller, 50, 150);
    moveTo(100, 180);
    act(() => {
      scroller.scrollTop = 100;
      fireEvent.scroll(scroller);
    });
    expect(vertical(scroller)).toEqual({ top: '150px', height: '50px' });
  });
});

describe('the rows’ measurement', () => {
  it('⚠️ is never taken from the rectangle, even over an empty list', () => {
    const link = { rowsPerPage: 0 };
    const { scroller } = renderGrid({}, { keyboard: link }, 0);
    expect(link.rowsPerPage).toBe(Math.floor(VIEW.height / ROW));
    const rectangle = scroller.querySelector('[data-table-marquee]') as HTMLElement;
    rectangle.getBoundingClientRect = () => ({ height: 150 }) as DOMRect;
    press(scroller, 10, 20);
    moveTo(10, 170);
    // Any render measures again; a scroll is one.
    act(() => {
      scroller.scrollTop = 1;
      fireEvent.scroll(scroller);
    });
    expect(link.rowsPerPage).toBe(Math.floor(VIEW.height / ROW));
  });
});

describe('the release', () => {
  it('⚠️ reports the rows as they are at the release, not as they were at the last move', () => {
    const { scroller, onMarquee, rerender } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 150);
    // The list shrank under the drag, to three rows.
    rerender(
      <TableGrid
        label="Things"
        header={<div role="row" aria-rowindex={1} />}
        colCount={1}
        total={3}
        rowKey={String}
        renderRow={(i, place) => <div role="row" id={place.id} data-row={i} style={place.style} />}
        fill
        focus={null}
        rowIdPrefix="m"
        rowHeightRem={ROW / 16}
        marquee={{ refusePress: () => false, threshold: 4, onMarquee }}
      />,
    );
    release();
    expect(reports(onMarquee).at(-1)).toEqual(['end', { anchor: 1, head: 2 }]);
  });
});

describe('cancelling', () => {
  it('Escape cancels a running marquee, and nothing else hears it', () => {
    const { scroller, onMarquee } = renderGrid();
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    press(scroller, 10, 30);
    moveTo(10, 100);
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    document.removeEventListener('keydown', heard);
    expect(reports(onMarquee).at(-1)).toEqual(['cancel', { anchor: 1, head: 3 }]);
    expect(heard).not.toHaveBeenCalled();
    release();
    expect(onMarquee).toHaveBeenCalledTimes(2);
  });

  it('Escape before the threshold is the consumer’s', () => {
    const { scroller, onMarquee } = renderGrid();
    const heard = vi.fn();
    document.addEventListener('keydown', heard);
    press(scroller, 10, 30);
    fireEvent.keyDown(document, { key: 'Escape' });
    document.removeEventListener('keydown', heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(onMarquee).not.toHaveBeenCalled();
  });

  it('losing the window cancels it', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    act(() => {
      fireEvent.blur(window);
    });
    expect(reports(onMarquee).at(-1)![0]).toBe('cancel');
    const count = onMarquee.mock.calls.length;
    moveTo(10, 150);
    expect(onMarquee).toHaveBeenCalledTimes(count);
  });

  it('⚠️ a grid gone mid-drag reports nothing more, not even a cancel', () => {
    const { scroller, onMarquee, unmount } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    const before = onMarquee.mock.calls.length;
    unmount();
    moveTo(10, 150);
    fireEvent.mouseUp(document);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onMarquee).toHaveBeenCalledTimes(before);
  });

  it('a second press detaches the first drag', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    press(scroller, 10, 150);
    moveTo(10, 100);
    expect(reports(onMarquee)).toEqual([['start', { anchor: 5, head: 3 }]]);
  });

  it('⚠️ a second press cancels a first drag that had started, so its consumer is not left mid-drag', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    press(scroller, 10, 150);
    expect(reports(onMarquee).at(-1)).toEqual(['cancel', { anchor: 1, head: 3 }]);
  });

  it('⚠️ a second press measures from where the first drag’s cancel left the scroll', () => {
    const onMarquee = vi.fn();
    const { scroller } = renderGrid({
      // A consumer that puts the scroll back on cancel.
      onMarquee: (m) => {
        onMarquee(m);
        if (m.phase === 'cancel') scroller.scrollTop = 0;
      },
    });
    press(scroller, 10, 30);
    moveTo(10, 100);
    act(() => {
      scroller.scrollTop = 56;
      fireEvent.scroll(scroller);
    });
    press(scroller, 10, 150);
    moveTo(10, 100);
    expect(reports(onMarquee).at(-1)).toEqual(['start', { anchor: 5, head: 3 }]);
  });

  it('⚠️ releasing another button leaves the drag running', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    release(2);
    moveTo(10, 130);
    expect(reports(onMarquee).at(-1)).toEqual(['move', { anchor: 1, head: 4 }]);
  });

  it('⚠️ a move with the button no longer held ends the drag, as its lost release would have', () => {
    const { scroller, onMarquee } = renderGrid();
    press(scroller, 10, 30);
    moveTo(10, 100);
    moveTo(10, 130, { buttons: 0 });
    moveTo(10, 160);
    expect(reports(onMarquee)).toEqual([
      ['start', { anchor: 1, head: 3 }],
      ['end', { anchor: 1, head: 3 }],
    ]);
  });
});
