// @vitest-environment jsdom
/**
 * The engine's header on its own columns.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TableGrid } from './TableGrid.js';
import { TableHeader, type TableHeaderProps } from './TableHeader.js';

afterEach(cleanup);

type Key = 'a' | 'b';
const COLUMNS = [
  { key: 'a' as const, label: 'Alpha', width: 100 },
  { key: 'b' as const, label: 'Beta', width: 60 },
];

function renderHeader(over: Partial<TableHeaderProps<Key>> = {}) {
  const { container, unmount } = render(
    <TableHeader
      columns={COLUMNS}
      sort={undefined}
      gridStyle={{}}
      onSort={vi.fn()}
      onResize={vi.fn()}
      resizeLabel="Resize"
      refusePress={() => false}
      {...over}
    />,
  );
  return { header: container.firstElementChild as HTMLElement, unmount };
}

const handle = (header: HTMLElement, key: Key) =>
  header.querySelector(`[data-table-resize="${key}"]`) as HTMLElement;

/** A move with the primary button still held, as a browser sends during a drag. */
const move = (x: number, init: MouseEventInit = {}) =>
  act(() => {
    fireEvent.mouseMove(document, { clientX: x, buttons: 1, ...init });
  });

describe('resizing', () => {
  it('reports the dragged width unclamped — the consumer’s model clamps', () => {
    const onResize = vi.fn();
    const { header } = renderHeader({ onResize });
    fireEvent.mouseDown(handle(header, 'b'), { button: 0, clientX: 500 });
    move(400);
    expect(onResize).toHaveBeenLastCalledWith('b', -40);
  });

  it('divides by the scale, so a scaled copy moves in table px', () => {
    const onResize = vi.fn();
    const { header } = renderHeader({ onResize, scale: 0.5 });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(10);
    expect(onResize).toHaveBeenLastCalledWith('a', 120);
  });

  it('stops at the release', () => {
    const onResize = vi.fn();
    const { header } = renderHeader({ onResize });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    act(() => {
      fireEvent.mouseUp(document);
    });
    move(50);
    expect(onResize).not.toHaveBeenCalled();
  });

  it('⚠️ releasing another button leaves the drag running', () => {
    const onResize = vi.fn();
    const onResizeDrag = vi.fn();
    const { header } = renderHeader({ onResize, onResizeDrag });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    act(() => {
      fireEvent.mouseUp(document, { button: 2 });
    });
    move(30);
    expect(onResize).toHaveBeenLastCalledWith('a', 130);
    expect(onResizeDrag).not.toHaveBeenCalledWith(null);
  });

  it('⚠️ a move with the button no longer held ends the drag, as its lost release would have', () => {
    const onResize = vi.fn();
    const onResizeDrag = vi.fn();
    const { header } = renderHeader({ onResize, onResizeDrag });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(30);
    move(50, { buttons: 0 });
    expect(onResize).toHaveBeenLastCalledWith('a', 130);
    expect(onResizeDrag).toHaveBeenLastCalledWith(null);
    expect(handle(header, 'a').querySelector('span')!.className.split(' ')).toContain(
      'justable:bg-(--table-resize-line)',
    );
    const told = onResizeDrag.mock.calls.length;
    move(70);
    expect(onResizeDrag).toHaveBeenCalledTimes(told);
    expect(onResize).toHaveBeenLastCalledWith('a', 130);
  });

  it('⚠️ a header gone mid-drag writes nothing more', () => {
    const onResize = vi.fn();
    const { header, unmount } = renderHeader({ onResize });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    unmount();
    move(50);
    expect(onResize).not.toHaveBeenCalled();
  });

  it('names every handle', () => {
    const { header } = renderHeader();
    expect(handle(header, 'a').getAttribute('aria-label')).toBe('Resize');
  });
});

describe('resizing inside a grid that scrolls', () => {
  function renderInGrid(over: Partial<TableHeaderProps<Key>> = {}) {
    const { container, unmount } = render(
      <TableGrid
        label="t"
        header={
          <TableHeader
            columns={COLUMNS}
            sort={undefined}
            gridStyle={{}}
            onSort={vi.fn()}
            onResize={vi.fn()}
            resizeLabel="Resize"
            refusePress={() => false}
            {...over}
          />
        }
        colCount={2}
        total={0}
        renderRow={() => null}
        rowKey={String}
        fill
        focus={null}
        rowIdPrefix="t"
        rowHeightRem={2}
      />,
    );
    const grid = container.firstElementChild as HTMLElement;
    const header = grid.querySelector('[data-table-header]') as HTMLElement;
    const scroller = grid.querySelectorAll(':scope > [role="rowgroup"]')[1] as HTMLElement;
    // jsdom lays nothing out: the scroller's content and view widths are set by hand.
    const box = { content: 1000, view: 100 };
    Object.defineProperty(scroller, 'scrollWidth', { get: () => box.content });
    Object.defineProperty(scroller, 'clientWidth', { get: () => box.view });
    return { header, scroller, box, unmount };
  }

  const scrollTo = (scroller: HTMLElement, left: number) =>
    act(() => {
      scroller.scrollLeft = left;
      fireEvent.scroll(scroller);
    });

  it('a scroll during a drag widens the column by the distance scrolled, the pointer still', () => {
    const onResize = vi.fn();
    const { header, scroller } = renderInGrid({ onResize });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(10);
    scrollTo(scroller, 30);
    expect(onResize).toHaveBeenLastCalledWith('a', 140);
  });

  it('the scroll is in table px already, so the scale divides only the pointer', () => {
    const onResize = vi.fn();
    const { header, scroller } = renderInGrid({ onResize, scale: 0.5 });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(10);
    scrollTo(scroller, 30);
    expect(onResize).toHaveBeenLastCalledWith('a', 150);
  });

  it('⚠️ a scroll whose event has not arrived yet still counts at the release', () => {
    const onResize = vi.fn();
    const { header, scroller } = renderInGrid({ onResize });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(10);
    act(() => {
      scroller.scrollLeft = 16;
      fireEvent.mouseUp(document);
    });
    expect(onResize).toHaveBeenLastCalledWith('a', 126);
  });

  it('a pointer move reads the scroll too, whether or not its event came first', () => {
    const onResize = vi.fn();
    const { header, scroller } = renderInGrid({ onResize });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    scroller.scrollLeft = 16;
    move(10);
    expect(onResize).toHaveBeenLastCalledWith('a', 126);
  });

  it('⚠️ during a drag the content keeps its widest width, so a browser has no scroll to pull back', () => {
    const { header, scroller, box } = renderInGrid();
    const canvas = scroller.querySelector('[role="presentation"]') as HTMLElement;
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    expect(canvas.style.minWidth).toBe('1000px');
    box.content = 1200;
    move(20);
    expect(canvas.style.minWidth).toBe('1200px');
    box.content = 900;
    move(-20);
    expect(canvas.style.minWidth).toBe('1200px');
    act(() => {
      fireEvent.mouseUp(document);
    });
    expect(canvas.style.minWidth).toBe('');
  });

  it('scrolled to the end, a loop scrolling left still counts', () => {
    const onResize = vi.fn();
    const { header, scroller } = renderInGrid({ onResize });
    scroller.scrollLeft = 900;
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    scrollTo(scroller, 880);
    expect(onResize).toHaveBeenLastCalledWith('a', 80);
  });

  it('a scroll after the release reports nothing', () => {
    const onResize = vi.fn();
    const { header, scroller } = renderInGrid({ onResize });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    act(() => {
      fireEvent.mouseUp(document);
    });
    scrollTo(scroller, 30);
    expect(onResize).not.toHaveBeenCalled();
  });

  it('tells the consumer each move with the scroller, then null at the release', () => {
    const onResizeDrag = vi.fn();
    const { header, scroller } = renderInGrid({ onResizeDrag });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 40, clientY: 7, buttons: 1 });
    });
    expect(onResizeDrag).toHaveBeenLastCalledWith({ clientX: 40, clientY: 7, scroller });
    act(() => {
      fireEvent.mouseUp(document);
    });
    expect(onResizeDrag).toHaveBeenLastCalledWith(null);
    expect(onResizeDrag).toHaveBeenCalledTimes(2);
  });

  it('⚠️ a second press tells the consumer null for the first drag before the second moves', () => {
    const onResizeDrag = vi.fn();
    const { header, scroller } = renderInGrid({ onResizeDrag });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(5);
    fireEvent.mouseDown(handle(header, 'b'), { button: 0, clientX: 5 });
    move(9);
    expect(onResizeDrag.mock.calls.map(([d]) => d?.clientX ?? null)).toEqual([5, null, 9]);
    expect(onResizeDrag).toHaveBeenLastCalledWith({ clientX: 9, clientY: 0, scroller });
  });

  it('⚠️ a second press reads the scroll only after the first drag has let go of it', () => {
    const onResize = vi.fn();
    const at: { scroller?: HTMLElement } = {};
    // The first drag's end moves the scroll, as a browser clamping it to the released width does.
    const onResizeDrag = (drag: unknown) => {
      if (drag === null) at.scroller!.scrollLeft = 400;
    };
    const { header, scroller } = renderInGrid({ onResize, onResizeDrag });
    at.scroller = scroller;
    scroller.scrollLeft = 500;
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(5);
    fireEvent.mouseDown(handle(header, 'b'), { button: 0, clientX: 5 });
    move(10);
    expect(onResize).toHaveBeenLastCalledWith('b', 65);
  });

  it('⚠️ a header gone mid-drag tells the consumer null, so its loop stops', () => {
    const onResizeDrag = vi.fn();
    const { header, unmount } = renderInGrid({ onResizeDrag });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    move(5);
    unmount();
    expect(onResizeDrag).toHaveBeenLastCalledWith(null);
  });

  it('a header outside a grid hands the consumer no scroller', () => {
    const onResizeDrag = vi.fn();
    const { header } = renderHeader({ onResizeDrag });
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 5, clientY: 1, buttons: 1 });
    });
    expect(onResizeDrag).toHaveBeenLastCalledWith({ clientX: 5, clientY: 1, scroller: null });
  });
});

describe('which press arms a resize', () => {
  const press = (header: HTMLElement, button: number) =>
    fireEvent.mouseDown(handle(header, 'a'), { button, clientX: 0 });

  it('a consumer predicate that refuses stops the resize, and it is asked with the press', () => {
    const onResize = vi.fn();
    const refusePress = vi.fn((_event: React.MouseEvent) => true);
    const { header } = renderHeader({ onResize, refusePress });
    press(header, 0);
    move(30);
    expect(refusePress).toHaveBeenCalledTimes(1);
    expect(refusePress.mock.calls[0]![0]).toMatchObject({ button: 0 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('a consumer predicate that allows lets any press arm — the engine holds no rule for which button arms', () => {
    const onResize = vi.fn();
    const { header } = renderHeader({ onResize, refusePress: () => false });
    press(header, 2);
    move(30, { buttons: 2 });
    expect(onResize).toHaveBeenLastCalledWith('a', 130);
  });

  it('⚠️ the default is suppressed for every button, refused or not', () => {
    const { header } = renderHeader({ refusePress: () => true });
    for (const button of [0, 1, 2]) expect(press(header, button), `button ${button}`).toBe(false);
  });
});

describe('the resize line', () => {
  const line = (header: HTMLElement) => handle(header, 'a').querySelector('span') as HTMLElement;

  /**
   * One background utility at a time. Two on one element leave the winner to stylesheet order —
   * the engine's class join does not resolve conflicts.
   */
  it('carries one background colour at rest and one while dragged', () => {
    const { header } = renderHeader();
    const bgs = () =>
      line(header)
        .className.split(' ')
        .filter((c) => c.startsWith('justable:bg-'));
    expect(bgs()).toEqual(['justable:bg-(--table-resize-line)']);
    fireEvent.mouseDown(handle(header, 'a'), { button: 0, clientX: 0 });
    expect(bgs()).toEqual(['justable:bg-(--table-resize-line-active)']);
  });
});

describe('sorting', () => {
  it('a press on a header cell sorts that column', () => {
    const onSort = vi.fn();
    const { header } = renderHeader({ onSort });
    fireEvent.click(header.querySelectorAll('button')[1]!);
    expect(onSort).toHaveBeenCalledWith('b');
  });

  /**
   * ⚠️ The package ships no preflight, so the sort button must undo a browser's button styles itself.
   * jsdom computes no CSS, so this pins the classes; the example measures the effect in a browser.
   */
  it('the sort button clears what a browser gives a button', () => {
    const { header } = renderHeader();
    const classes = header.querySelector('button')!.className.split(' ');
    for (const reset of [
      'justable:m-0',
      'justable:border-0',
      'justable:bg-transparent',
      'justable:py-0',
      'justable:[font-family:inherit]',
      'justable:text-[length:inherit]',
      'justable:leading-[inherit]',
    ]) {
      expect(classes, reset).toContain(reset);
    }
  });

  it('the sorted column alone carries `aria-sort` and an arrow', () => {
    const { header } = renderHeader({ sort: { key: 'b', desc: true } });
    const cells = [...header.querySelectorAll('[role="columnheader"]')];
    expect(cells.map((c) => c.getAttribute('aria-sort'))).toEqual([null, 'descending']);
    expect(cells.map((c) => c.querySelector('svg') !== null)).toEqual([false, true]);
  });
});
