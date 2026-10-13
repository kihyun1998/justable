// @vitest-environment jsdom
/**
 * The engine's header on its own columns.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Profiler } from 'react';
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

describe('moving', () => {
  type M = 'a' | 'b' | 'c';
  const MOVE_COLUMNS = [
    { key: 'a' as const, label: 'Alpha', width: 100, movable: false },
    { key: 'b' as const, label: 'Beta', width: 100, movable: true },
    { key: 'c' as const, label: 'Gamma', width: 100, movable: true },
  ];

  /**
   * jsdom lays nothing out: each cell's screen box is `scale` × its layout box, and its layout box is
   * 100 px wide, side by side from 0.
   */
  function renderMovable(over: Partial<TableHeaderProps<M>> = {}, scale = 1) {
    const onSort = vi.fn();
    const onMove = vi.fn();
    const refusePress = vi.fn(() => false);
    const { container } = render(
      <TableHeader
        columns={MOVE_COLUMNS}
        sort={undefined}
        gridStyle={{}}
        onSort={onSort}
        onResize={vi.fn()}
        resizeLabel="Resize"
        refusePress={() => false}
        move={{ refusePress, threshold: 4, onMove }}
        scale={scale}
        {...over}
      />,
    );
    const header = container.firstElementChild as HTMLElement;
    const cells = [...header.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    cells.forEach((cell, i) => {
      Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
      Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
      cell.getBoundingClientRect = () =>
        ({ left: i * 100 * scale, right: (i + 1) * 100 * scale, top: 0, bottom: 20 }) as DOMRect;
    });
    const button = (key: M) => cells[MOVE_COLUMNS.findIndex((c) => c.key === key)]!.querySelector('button')!;
    const indicator = () => header.querySelector<HTMLElement>('[data-table-move-indicator]');
    return { header, button, indicator, onSort, onMove, refusePress };
  }

  /** A press on `key`'s sort button, moves to each x, then the release and the click it brings. */
  function drag(button: HTMLElement, from: number, ...to: number[]) {
    fireEvent.mouseDown(button, { button: 0, clientX: from, clientY: 5 });
    for (const x of to) move(x, { clientY: 5 });
    act(() => {
      fireEvent.mouseUp(document, { button: 0, clientX: to.at(-1) ?? from });
    });
    fireEvent.click(button, { detail: 1 });
  }

  it('a press that stays within the threshold is a sort press', () => {
    const { button, onSort, onMove } = renderMovable();
    drag(button('b'), 150, 154);
    expect(onSort).toHaveBeenCalledWith('b');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('past the threshold the press is a move: the drop reports once, and no sort follows', () => {
    const { button, onSort, onMove } = renderMovable();
    drag(button('b'), 150, 200, 290);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('b', null);
    expect(onSort).not.toHaveBeenCalled();
  });

  it('lands before the column whose middle the pointer has not passed', () => {
    const { button, onMove } = renderMovable();
    drag(button('c'), 250, 120);
    expect(onMove).toHaveBeenCalledWith('c', 'b');
  });

  it('no movable column passes an unmovable one', () => {
    const { button, onMove } = renderMovable();
    drag(button('c'), 250, 10);
    expect(onMove).toHaveBeenCalledWith('c', 'b');
  });

  it('a drop where the column already is reports nothing, and still eats the click', () => {
    const { button, onSort, onMove } = renderMovable();
    drag(button('b'), 150, 170);
    expect(onMove).not.toHaveBeenCalled();
    expect(onSort).not.toHaveBeenCalled();
  });

  it('shows where the column will land while it is dragged, and nothing after', () => {
    const { button, indicator } = renderMovable();
    fireEvent.mouseDown(button('b'), { button: 0, clientX: 150, clientY: 5 });
    move(152, { clientY: 5 });
    expect(indicator()).toBeNull();
    move(290, { clientY: 5 });
    expect(indicator()!.style.left).toBe('300px');
    move(60, { clientY: 5 });
    expect(indicator()!.style.left).toBe('100px');
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    expect(indicator()).toBeNull();
  });

  it('under a scale, finds the slot on screen and draws the line in table px', () => {
    const { button, indicator, onMove } = renderMovable({}, 0.5);
    fireEvent.mouseDown(button('c'), { button: 0, clientX: 125, clientY: 5 });
    move(60, { clientY: 5 });
    expect(indicator()!.style.left).toBe('100px');
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    expect(onMove).toHaveBeenCalledWith('c', 'b');
  });

  it('a scroll under a still pointer moves the landing place', () => {
    const onMove = vi.fn();
    const { container } = render(
      <TableGrid
        label="t"
        header={
          <TableHeader
            columns={MOVE_COLUMNS}
            sort={undefined}
            gridStyle={{}}
            onSort={vi.fn()}
            onResize={vi.fn()}
            resizeLabel="Resize"
            refusePress={() => false}
            move={{ refusePress: () => false, threshold: 4, onMove }}
          />
        }
        colCount={3}
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
    const scroller = grid.querySelectorAll(':scope > [role="rowgroup"]')[1] as HTMLElement;
    let scrolled = 0;
    const cells = [...grid.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    cells.forEach((cell, i) => {
      Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
      Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
      cell.getBoundingClientRect = () =>
        ({ left: i * 100 - scrolled, right: (i + 1) * 100 - scrolled, top: 0, bottom: 20 }) as DOMRect;
    });
    fireEvent.mouseDown(cells[1]!.querySelector('button')!, { button: 0, clientX: 150, clientY: 5 });
    move(240, { clientY: 5 });
    act(() => {
      scrolled = 100;
      fireEvent.scroll(scroller);
    });
    expect(grid.querySelector<HTMLElement>('[data-table-move-indicator]')!.style.left).toBe('300px');
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    expect(onMove).toHaveBeenCalledWith('b', null);
  });

  it('a move that keeps the landing place renders nothing', () => {
    let commits = 0;
    const { container } = render(
      <Profiler id="header" onRender={() => (commits += 1)}>
        <TableHeader
          columns={MOVE_COLUMNS}
          sort={undefined}
          gridStyle={{}}
          onSort={vi.fn()}
          onResize={vi.fn()}
          resizeLabel="Resize"
          refusePress={() => false}
          move={{ refusePress: () => false, threshold: 4, onMove: vi.fn() }}
        />
      </Profiler>,
    );
    const cells = [...container.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    cells.forEach((cell, i) => {
      Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
      cell.getBoundingClientRect = () =>
        ({ left: i * 100, right: (i + 1) * 100, top: 0, bottom: 20 }) as DOMRect;
    });
    fireEvent.mouseDown(cells[1]!.querySelector('button')!, { button: 0, clientX: 150, clientY: 5 });
    move(260, { clientY: 5 });
    const shown = commits;
    move(270, { clientY: 5 });
    move(280, { clientY: 5 });
    expect(commits).toBe(shown);
  });

  it('a press on a resize handle never starts a move', () => {
    const { header, onMove } = renderMovable();
    fireEvent.mouseDown(handle(header as HTMLElement, 'b' as Key), { button: 0, clientX: 200 });
    move(290);
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('an unmovable column does not move', () => {
    const { button, onSort, onMove, indicator } = renderMovable();
    fireEvent.mouseDown(button('a'), { button: 0, clientX: 50, clientY: 5 });
    move(290, { clientY: 5 });
    expect(indicator()).toBeNull();
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    fireEvent.click(button('a'), { detail: 1 });
    expect(onMove).not.toHaveBeenCalled();
    expect(onSort).toHaveBeenCalledWith('a');
  });

  it('a press the consumer refuses does not move', () => {
    const { button, onMove, refusePress } = renderMovable();
    refusePress.mockReturnValue(true);
    drag(button('b'), 150, 290);
    expect(refusePress).toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('without `move` the header moves nothing, as before', () => {
    const { button, onSort, indicator } = renderMovable({ move: undefined });
    fireEvent.mouseDown(button('b'), { button: 0, clientX: 150, clientY: 5 });
    move(290, { clientY: 5 });
    expect(indicator()).toBeNull();
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    fireEvent.click(button('b'), { detail: 1 });
    expect(onSort).toHaveBeenCalledWith('b');
  });
});
