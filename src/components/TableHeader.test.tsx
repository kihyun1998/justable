// @vitest-environment jsdom
/**
 * The engine's header on its own columns.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTableModel } from '../lib/tableModel.js';
import type { ColumnLayout, ColumnSpec } from '../types.js';
import { TableGrid } from './TableGrid.js';
import { TableHeader, type TableHeaderProps } from './TableHeader.js';
import { TableRow } from './TableRow.js';

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
  const spec = (key: M, movable: boolean): ColumnSpec<unknown, M> => ({
    key,
    defaultWidth: 100,
    minWidth: 10,
    maxWidth: 500,
    hideable: false,
    movable,
    firstSortDesc: false,
    compare: () => 0,
  });
  const model = createTableModel<unknown, M>([spec('a', false), spec('b', true), spec('c', true)]);
  const LAYOUT: ColumnLayout<M> = { widths: {}, hidden: [] };
  const targets = (key: M) => model.moveTargets(LAYOUT, key);

  const MOVE_COLUMNS = [
    { key: 'a' as const, label: 'Alpha', width: 100 },
    { key: 'b' as const, label: 'Beta', width: 100 },
    { key: 'c' as const, label: 'Gamma', width: 100 },
  ];

  /**
   * jsdom lays nothing out: each cell's screen box is `scale` × its layout box, and its layout box is
   * 100 px wide, side by side from 0.
   */
  function renderMovable(over: Partial<TableHeaderProps<M>> = {}, scale = 1) {
    const onSort = vi.fn();
    const onMove = vi.fn();
    const refusePress = vi.fn(() => false);
    const { container, unmount } = render(
      <TableHeader
        columns={MOVE_COLUMNS}
        sort={undefined}
        gridStyle={{}}
        onSort={onSort}
        onResize={vi.fn()}
        resizeLabel="Resize"
        refusePress={() => false}
        move={{ refusePress, threshold: 4, targets, onMove }}
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
    return { header, button, indicator, onSort, onMove, refusePress, unmount };
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
            move={{ refusePress: () => false, threshold: 4, targets, onMove }}
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
          move={{ refusePress: () => false, threshold: 4, targets, onMove: vi.fn() }}
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

  it('a hidden unmovable column bounds the move: the line stops before it, and the drop is one the model makes', () => {
    type Q = 'a' | 'b' | 'pin' | 'c';
    const hideable = (key: Q, movable: boolean): ColumnSpec<unknown, Q> => ({
      key,
      defaultWidth: 100,
      minWidth: 10,
      maxWidth: 500,
      hideable: true,
      movable,
      firstSortDesc: false,
      compare: () => 0,
    });
    const pinned = createTableModel<unknown, Q>([
      hideable('a', true),
      hideable('b', true),
      hideable('pin', false),
      hideable('c', true),
    ]);
    const layout: ColumnLayout<Q> = { widths: {}, hidden: ['pin'] };
    const onMove = vi.fn();
    const { container } = render(
      <TableHeader
        columns={pinned.visibleColumns(layout).map((key) => ({ key, label: key, width: 100 }))}
        sort={undefined}
        gridStyle={{}}
        onSort={vi.fn()}
        onResize={vi.fn()}
        resizeLabel="Resize"
        refusePress={() => false}
        move={{
          refusePress: () => false,
          threshold: 4,
          targets: (key) => pinned.moveTargets(layout, key),
          onMove,
        }}
      />,
    );
    const cells = [...container.querySelectorAll<HTMLElement>('[role="columnheader"]')];
    cells.forEach((cell, i) => {
      Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
      Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
      cell.getBoundingClientRect = () =>
        ({ left: i * 100, right: (i + 1) * 100, top: 0, bottom: 20 }) as DOMRect;
    });
    fireEvent.mouseDown(cells[0]!.querySelector('button')!, { button: 0, clientX: 50, clientY: 5 });
    move(290, { clientY: 5 });
    expect(container.querySelector<HTMLElement>('[data-table-move-indicator]')!.style.left).toBe('200px');
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    expect(onMove).toHaveBeenCalledWith('a', 'pin');
    const [key, before] = onMove.mock.calls[0]!;
    expect(pinned.visibleColumns(pinned.withOrder(layout, key, before))).toEqual(['b', 'a', 'c']);
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

  describe('sliding', () => {
    const BAND = 10;
    /**
     * `renderMovable` with `slide`. The header row is 300 layout px wide, its screen box `scale` × that
     * from 0, so a column's planned centre is `(offsetLeft + shift + 50) × scale`.
     */
    function renderSliding(scale = 1, over: Partial<TableHeaderProps<M>> = {}) {
      const onDrag = vi.fn();
      const onMove = vi.fn();
      const view = renderMovable(
        { move: { refusePress: () => false, threshold: 4, targets, onMove, onDrag, slide: { band: BAND } }, ...over },
        scale,
      );
      Object.defineProperty(view.header, 'offsetWidth', { get: () => 300, configurable: true });
      view.header.getBoundingClientRect = () =>
        ({ left: 0, right: 300 * scale, width: 300 * scale, top: 0, bottom: 20 }) as DOMRect;
      const shifts = () => [1, 2, 3].map((n) => view.header.style.getPropertyValue(`--justable-move-shift-${n}`));
      return { ...view, onDrag, onMove, shifts };
    }
    const press = (button: HTMLElement, x: number) =>
      fireEvent.mouseDown(button, { button: 0, clientX: x, clientY: 5 });
    const release = () =>
      act(() => {
        fireEvent.mouseUp(document, { button: 0 });
      });

    it('is opt-in: without `slide` no shift is written and the header cells read none', () => {
      const { header, button } = renderMovable();
      press(button('b'), 150);
      move(290, { clientY: 5 });
      expect(header.style.getPropertyValue('--justable-move-shift-2')).toBe('');
      expect(header.querySelector<HTMLElement>('[role="columnheader"]')!.style.translate).toBe('');
    });

    it('`band` is required inside `slide`, as the threshold is', () => {
      // Never called: `pnpm typecheck` is what runs these lines.
      const unwritten = (): NonNullable<TableHeaderProps<M>['move']>[] => [
        // @ts-expect-error: the dead band has no default.
        { refusePress: () => false, threshold: 4, targets, onMove: () => {}, slide: {} },
      ];
      expect(unwritten).toBeTypeOf('function');
    });

    /** What a cell reads its slide from: its own column's shift and seat, and the translate class. */
    const slideReads = (cell: HTMLElement) => ({
      shift: cell.style.getPropertyValue('--justable-shift'),
      moving: cell.style.getPropertyValue('--justable-moving'),
      translate: cell.style.translate,
      sliding: cell.className.includes('justable:in-data-[table-sliding]:translate-x-(--justable-shift)'),
    });
    const expectedReads = (n: number) => ({
      shift: `var(--justable-move-shift-${n}, 0px)`,
      moving: `var(--justable-move-seat-${n}, 0)`,
      translate: '',
      sliding: true,
    });

    it('each header cell reads its own column’s shift and seat, and translates only while a slide runs', () => {
      const { header } = renderSliding();
      const cells = [...header.querySelectorAll<HTMLElement>('[role="columnheader"]')];
      expect(cells.map(slideReads)).toEqual([1, 2, 3].map(expectedReads));
    });

    it('each body cell reads its own column’s shift and seat the same way, with no translate of its own', () => {
      const { container } = render(
        <TableRow
          columns={['a', 'b', 'c']}
          gridStyle={{}}
          rowIndex={2}
          cell={(key) => key}
          cellClassName={() => 'mine'}
        />,
      );
      const cells = [...container.querySelectorAll<HTMLElement>('[role="gridcell"]')];
      expect(cells.map(slideReads)).toEqual([1, 2, 3].map(expectedReads));
      expect(cells.every((c) => c.classList.contains('mine'))).toBe(true);
    });

    it('inside a grid, the moved column’s seat is written beside the shifts, and both go at the release', () => {
      const renderRow = vi.fn((i: number, place: { id: string; rowIndex: number; style?: React.CSSProperties }) => (
        <TableRow
          key={i}
          id={place.id}
          rowIndex={place.rowIndex}
          style={place.style}
          columns={['a', 'b', 'c']}
          gridStyle={{}}
          cell={(key) => key}
        />
      ));
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
              move={{ refusePress: () => false, threshold: 4, targets, onMove: vi.fn(), slide: { band: BAND } }}
            />
          }
          colCount={3}
          total={3}
          renderRow={renderRow}
          rowKey={String}
          fill
          focus={null}
          rowIdPrefix="t"
          rowHeightRem={2}
        />,
      );
      const root = container.querySelector<HTMLElement>('[data-table]')!;
      const header = container.querySelector<HTMLElement>('[data-table-header]')!;
      Object.defineProperty(header, 'offsetWidth', { get: () => 300 });
      header.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300, top: 0, bottom: 20 }) as DOMRect;
      const cells = [...container.querySelectorAll<HTMLElement>('[role="columnheader"]')];
      cells.forEach((cell, i) => {
        Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
        Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
        cell.getBoundingClientRect = () =>
          ({ left: i * 100, right: (i + 1) * 100, top: 0, bottom: 20 }) as DOMRect;
      });
      fireEvent.mouseDown(cells[1]!.querySelector('button')!, { button: 0, clientX: 150, clientY: 5 });
      move(215, { clientY: 5 });
      expect([1, 2, 3].map((n) => root.style.getPropertyValue(`--justable-move-seat-${n}`))).toEqual(['', '1', '']);
      act(() => {
        fireEvent.mouseUp(document, { button: 0 });
      });
      expect([1, 2, 3].map((n) => root.style.getPropertyValue(`--justable-move-seat-${n}`))).toEqual(['', '', '']);
    });

    it('the seat slides to its landing slot and the column it passes makes room, once the leading edge passes the centre by the band', () => {
      const { button, shifts } = renderSliding();
      // Grabbed 50 px into Beta (100–200): its right edge is the pointer + 50, Gamma's centre 250.
      press(button('b'), 150);
      move(205, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '0px', '0px']);
      move(215, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '100px', '-100px']);
    });

    it('a column makes room at the same point wherever the moved one was grabbed', () => {
      const switchAt = (grab: number) => {
        const view = renderSliding();
        press(view.button('b'), 100 + grab);
        let x = 100 + grab;
        while (view.shifts()[2] !== '-100px' && x < 400) {
          x += 1;
          move(x, { clientY: 5 });
        }
        const chipLeft = x - grab;
        cleanup();
        return chipLeft;
      };
      expect(switchAt(10)).toBe(switchAt(90));
    });

    it('a reversal inside the band keeps the slot; one past it gives the slot back', () => {
      const { button, shifts } = renderSliding();
      press(button('b'), 150);
      move(215, { clientY: 5 });
      expect(shifts()[2]).toBe('-100px');
      // Back left: the leading edge is now the left, the pointer − 50, and Gamma is planned at 100–200.
      move(195, { clientY: 5 });
      expect(shifts()[2]).toBe('-100px');
      move(185, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '0px', '0px']);
    });

    it('onDrag’s drop and line, and the drop itself, follow the drawn gap', () => {
      const { button, onDrag, onMove } = renderSliding();
      press(button('b'), 150);
      move(205, { clientY: 5 });
      expect(onDrag.mock.calls.at(-1)![0]).toMatchObject({ beforeKey: undefined, line: { x: 100 }, grab: 50 });
      move(215, { clientY: 5 });
      expect(onDrag.mock.calls.at(-1)![0]).toMatchObject({ beforeKey: null, line: { x: 200 }, grab: 50 });
      release();
      expect(onMove).toHaveBeenCalledWith('b', null);
    });

    it('the engine’s own line sits where the seat lands', () => {
      const { button, indicator } = renderSliding(1, {
        move: { refusePress: () => false, threshold: 4, targets, onMove: vi.fn(), slide: { band: BAND } },
      });
      press(button('b'), 150);
      move(215, { clientY: 5 });
      expect(indicator()!.style.left).toBe('200px');
    });

    it('a drop on its own slot still reports nothing', () => {
      const { button, onMove } = renderSliding();
      press(button('b'), 150);
      move(205, { clientY: 5 });
      release();
      expect(onMove).not.toHaveBeenCalled();
    });

    it('inside a scaled copy, shifts stay layout px and the line is on screen', () => {
      const { button, shifts, onDrag } = renderSliding(0.5);
      // Screen: Beta 50–100, grabbed at 75 (25 in); Gamma's centre 125; switch past 125 + 5.
      press(button('b'), 75);
      move(105, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '0px', '0px']);
      move(112, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '100px', '-100px']);
      expect(onDrag.mock.calls.at(-1)![0]).toMatchObject({ line: { x: 100 }, grab: 25 });
    });

    it.each([
      ['its on-screen width is its layout width', (h: HTMLElement) => {
        h.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300, top: 0, bottom: 20 }) as DOMRect;
      }],
      ['its offsetWidth is 0', (h: HTMLElement) => {
        Object.defineProperty(h, 'offsetWidth', { get: () => 0 });
      }],
    ])('the slide converts with the header’s `scale`, not the header row’s box, when %s', (_, skew) => {
      const { header, button, shifts, onDrag } = renderSliding(0.5);
      skew(header);
      press(button('b'), 75);
      move(105, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '0px', '0px']);
      move(112, { clientY: 5 });
      expect(shifts()).toEqual(['0px', '100px', '-100px']);
      expect(onDrag.mock.calls.at(-1)![0]).toMatchObject({ line: { x: 100 }, grab: 25 });
    });

    it('marks the header while it slides, and clears every shift and the mark at the release', () => {
      const { header, button, shifts } = renderSliding();
      press(button('b'), 150);
      move(215, { clientY: 5 });
      expect(header.hasAttribute('data-table-sliding')).toBe(true);
      release();
      expect(shifts()).toEqual(['', '', '']);
      expect(header.hasAttribute('data-table-sliding')).toBe(false);
    });

    it('clears them on a cancel, a second press and an unmount too', () => {
      for (const end of ['escape', 'replace', 'unmount'] as const) {
        const { header, button, shifts, unmount } = renderSliding();
        press(button('b'), 150);
        move(215, { clientY: 5 });
        if (end === 'escape') {
          act(() => {
            fireEvent.keyDown(button('b'), { key: 'Escape' });
          });
        } else if (end === 'replace') {
          press(button('c'), 250);
        } else {
          unmount();
        }
        expect({ end, shifts: shifts(), sliding: header.hasAttribute('data-table-sliding') }).toEqual({
          end,
          shifts: ['', '', ''],
          sliding: false,
        });
        cleanup();
      }
    });

    it('moves that keep the slot render nothing', () => {
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
            move={{ refusePress: () => false, threshold: 4, targets, onMove: vi.fn(), slide: { band: BAND } }}
          />
        </Profiler>,
      );
      const header = container.querySelector<HTMLElement>('[data-table-header]')!;
      Object.defineProperty(header, 'offsetWidth', { get: () => 300 });
      header.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300, top: 0, bottom: 20 }) as DOMRect;
      const cells = [...container.querySelectorAll<HTMLElement>('[role="columnheader"]')];
      cells.forEach((cell, i) => {
        Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
        Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
        cell.getBoundingClientRect = () =>
          ({ left: i * 100, right: (i + 1) * 100, top: 0, bottom: 20 }) as DOMRect;
      });
      fireEvent.mouseDown(cells[1]!.querySelector('button')!, { button: 0, clientX: 150, clientY: 5 });
      move(220, { clientY: 5 });
      const shown = commits;
      move(230, { clientY: 5 });
      move(240, { clientY: 5 });
      expect(commits).toBe(shown);
    });

    it('a hidden unmovable column bounds the slide: nothing shifts past it', () => {
      type Q = 'a' | 'b' | 'pin' | 'c';
      const hideable = (key: Q, movable: boolean): ColumnSpec<unknown, Q> => ({
        key,
        defaultWidth: 100,
        minWidth: 10,
        maxWidth: 500,
        hideable: true,
        movable,
        firstSortDesc: false,
        compare: () => 0,
      });
      const pinned = createTableModel<unknown, Q>([
        hideable('a', true),
        hideable('b', true),
        hideable('pin', false),
        hideable('c', true),
      ]);
      const layout: ColumnLayout<Q> = { widths: {}, hidden: ['pin'] };
      const onMove = vi.fn();
      const { container } = render(
        <TableHeader
          columns={pinned.visibleColumns(layout).map((key) => ({ key, label: key, width: 100 }))}
          sort={undefined}
          gridStyle={{}}
          onSort={vi.fn()}
          onResize={vi.fn()}
          resizeLabel="Resize"
          refusePress={() => false}
          move={{
            refusePress: () => false,
            threshold: 4,
            targets: (key) => pinned.moveTargets(layout, key),
            onMove,
            slide: { band: BAND },
          }}
        />,
      );
      const header = container.querySelector<HTMLElement>('[data-table-header]')!;
      Object.defineProperty(header, 'offsetWidth', { get: () => 300 });
      header.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300, top: 0, bottom: 20 }) as DOMRect;
      const cells = [...container.querySelectorAll<HTMLElement>('[role="columnheader"]')];
      cells.forEach((cell, i) => {
        Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
        Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
        cell.getBoundingClientRect = () =>
          ({ left: i * 100, right: (i + 1) * 100, top: 0, bottom: 20 }) as DOMRect;
      });
      fireEvent.mouseDown(cells[0]!.querySelector('button')!, { button: 0, clientX: 50, clientY: 5 });
      move(290, { clientY: 5 });
      expect([1, 2, 3].map((n) => header.style.getPropertyValue(`--justable-move-shift-${n}`))).toEqual([
        '100px',
        '-100px',
        '0px',
      ]);
      act(() => {
        fireEvent.mouseUp(document, { button: 0 });
      });
      expect(onMove).toHaveBeenCalledWith('a', 'pin');
    });

    it('inside a grid, the shifts are written on the grid root', () => {
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
              move={{ refusePress: () => false, threshold: 4, targets, onMove: vi.fn(), slide: { band: BAND } }}
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
      const root = container.querySelector<HTMLElement>('[data-table]')!;
      const header = container.querySelector<HTMLElement>('[data-table-header]')!;
      Object.defineProperty(header, 'offsetWidth', { get: () => 300 });
      header.getBoundingClientRect = () => ({ left: 0, right: 300, width: 300, top: 0, bottom: 20 }) as DOMRect;
      const cells = [...container.querySelectorAll<HTMLElement>('[role="columnheader"]')];
      cells.forEach((cell, i) => {
        Object.defineProperty(cell, 'offsetLeft', { get: () => i * 100 });
        Object.defineProperty(cell, 'offsetWidth', { get: () => 100 });
        cell.getBoundingClientRect = () =>
          ({ left: i * 100, right: (i + 1) * 100, top: 0, bottom: 20 }) as DOMRect;
      });
      fireEvent.mouseDown(cells[1]!.querySelector('button')!, { button: 0, clientX: 150, clientY: 5 });
      move(215, { clientY: 5 });
      expect(root.style.getPropertyValue('--justable-move-shift-3')).toBe('-100px');
      expect(root.hasAttribute('data-table-sliding')).toBe(true);
      expect(header.style.getPropertyValue('--justable-move-shift-3')).toBe('');
    });
  });

  describe('cancelled', () => {
    function renderCancellable() {
      const onDrag = vi.fn();
      const onMove = vi.fn();
      const onColumnKeyDown = vi.fn();
      const view = renderMovable({
        move: { refusePress: () => false, threshold: 4, targets, onMove, onDrag },
        onColumnKeyDown,
      });
      const moving = () => view.header.querySelectorAll('[data-table-moving]').length;
      /** Press `key`, travel past the threshold. */
      const start = (key: M, from: number, to: number) => {
        fireEvent.mouseDown(view.button(key), { button: 0, clientX: from, clientY: 5 });
        move(to, { clientY: 5 });
      };
      const releaseAndClick = (key: M) => {
        act(() => {
          fireEvent.mouseUp(document, { button: 0 });
        });
        fireEvent.click(view.button(key), { detail: 1 });
      };
      return { ...view, onDrag, onMove, onColumnKeyDown, moving, start, releaseAndClick };
    }
    const escape = (target: Element) =>
      act(() => {
        fireEvent.keyDown(target, { key: 'Escape' });
      });

    it('Escape past the threshold ends the move: no drop, null once, no mark, no line', () => {
      const { button, onDrag, onMove, moving, indicator, start, releaseAndClick } = renderCancellable();
      start('b', 150, 290);
      const reported = onDrag.mock.calls.length;
      escape(button('b'));
      expect(onDrag.mock.calls.slice(reported)).toEqual([[null]]);
      expect(moving()).toBe(0);
      expect(indicator()).toBeNull();
      move(200, { clientY: 5 });
      releaseAndClick('b');
      expect(onMove).not.toHaveBeenCalled();
      expect(onDrag.mock.calls.slice(reported)).toEqual([[null]]);
    });

    it('the engine’s line goes with the Escape too', () => {
      const { button, indicator } = renderMovable();
      fireEvent.mouseDown(button('b'), { button: 0, clientX: 150, clientY: 5 });
      move(290, { clientY: 5 });
      expect(indicator()).not.toBeNull();
      escape(button('b'));
      expect(indicator()).toBeNull();
    });

    it('the cancelling Escape reaches neither the column’s key handler nor the document', () => {
      const { button, onColumnKeyDown, start } = renderCancellable();
      const heard = vi.fn();
      document.addEventListener('keydown', heard);
      start('b', 150, 290);
      escape(button('b'));
      document.removeEventListener('keydown', heard);
      expect(onColumnKeyDown).not.toHaveBeenCalled();
      expect(heard).not.toHaveBeenCalled();
    });

    it('⚠️ the release after an Escape sorts nothing', () => {
      const { button, onSort, start, releaseAndClick } = renderCancellable();
      start('b', 150, 290);
      escape(button('b'));
      releaseAndClick('b');
      expect(onSort).not.toHaveBeenCalled();
    });

    it('a lost window past the threshold cancels the same way', () => {
      const { onDrag, onMove, onSort, moving, start, releaseAndClick } = renderCancellable();
      start('b', 150, 290);
      const reported = onDrag.mock.calls.length;
      act(() => {
        fireEvent.blur(window);
      });
      expect(onDrag.mock.calls.slice(reported)).toEqual([[null]]);
      expect(moving()).toBe(0);
      releaseAndClick('b');
      expect(onMove).not.toHaveBeenCalled();
      expect(onSort).not.toHaveBeenCalled();
    });

    it('Escape before the threshold is the consumer’s, and the press still sorts', () => {
      const { button, onSort, onColumnKeyDown, onDrag, releaseAndClick } = renderCancellable();
      fireEvent.mouseDown(button('b'), { button: 0, clientX: 150, clientY: 5 });
      escape(button('b'));
      expect(onColumnKeyDown).toHaveBeenCalledTimes(1);
      releaseAndClick('b');
      expect(onSort).toHaveBeenCalledWith('b');
      expect(onDrag).not.toHaveBeenCalled();
    });

    it('a lost window before the threshold ends the press: a later move starts nothing', () => {
      const { button, onDrag, onMove, moving } = renderCancellable();
      fireEvent.mouseDown(button('b'), { button: 0, clientX: 150, clientY: 5 });
      act(() => {
        fireEvent.blur(window);
      });
      move(290, { clientY: 5 });
      act(() => {
        fireEvent.mouseUp(document, { button: 0 });
      });
      expect(onDrag).not.toHaveBeenCalled();
      expect(moving()).toBe(0);
      expect(onMove).not.toHaveBeenCalled();
    });

    it('⚠️ once a move has ended, Escape and a lost window do nothing more', () => {
      const { button, onDrag, start, releaseAndClick } = renderCancellable();
      start('b', 150, 290);
      releaseAndClick('b');
      const reported = onDrag.mock.calls.length;
      escape(button('b'));
      act(() => {
        fireEvent.blur(window);
      });
      expect(onDrag.mock.calls.length).toBe(reported);
    });

    it('a key other than Escape leaves a running move alone', () => {
      const { button, onMove, start, releaseAndClick } = renderCancellable();
      start('b', 150, 290);
      act(() => {
        fireEvent.keyDown(button('b'), { key: 'Enter' });
      });
      releaseAndClick('b');
      expect(onMove).toHaveBeenCalledWith('b', null);
    });
  });

  describe('drawn by the consumer', () => {
    /** `renderMovable` with `onDrag` given; the header row's screen box is 0–20 px tall. */
    function renderDrawn(scale = 1) {
      const onDrag = vi.fn();
      const onMove = vi.fn();
      const view = renderMovable(
        { move: { refusePress: () => false, threshold: 4, targets, onMove, onDrag } },
        scale,
      );
      view.header.getBoundingClientRect = () =>
        ({ left: 0, right: 300 * scale, top: 0, bottom: 20 }) as DOMRect;
      const moving = () =>
        [...view.header.querySelectorAll<HTMLElement>('[data-table-moving]')].map((c) => c.textContent);
      return { ...view, onDrag, onMove, moving };
    }
    const press = (button: HTMLElement, x: number) =>
      fireEvent.mouseDown(button, { button: 0, clientX: x, clientY: 5 });
    const release = () =>
      act(() => {
        fireEvent.mouseUp(document, { button: 0 });
      });

    it('reports nothing and marks nothing below the threshold', () => {
      const { button, onDrag, moving } = renderDrawn();
      press(button('b'), 150);
      move(154, { clientY: 5 });
      expect(onDrag).not.toHaveBeenCalled();
      expect(moving()).toEqual([]);
      release();
      expect(onDrag).not.toHaveBeenCalled();
    });

    it('reports nothing for a column with no slot but its own', () => {
      const { button, onDrag, moving } = renderDrawn();
      press(button('a'), 50);
      move(290, { clientY: 5 });
      release();
      expect(onDrag).not.toHaveBeenCalled();
      expect(moving()).toEqual([]);
    });

    it('past the threshold, reports each move in screen px: the column, the drop, the pointer, the line and the cell', () => {
      const { button, onDrag } = renderDrawn();
      press(button('b'), 150);
      move(200, { clientY: 6 });
      move(290, { clientY: 7 });
      expect(onDrag.mock.calls.map(([d]) => d)).toEqual([
        {
          key: 'b',
          beforeKey: undefined,
          clientX: 200,
          clientY: 6,
          line: { x: 200, top: 0, bottom: 20 },
          cell: { left: 100, top: 0, right: 200, bottom: 20 },
          grab: 50,
          scroller: null,
        },
        {
          key: 'b',
          beforeKey: null,
          clientX: 290,
          clientY: 7,
          line: { x: 300, top: 0, bottom: 20 },
          cell: { left: 100, top: 0, right: 200, bottom: 20 },
          grab: 50,
          scroller: null,
        },
      ]);
    });

    it('inside a scaled copy, the line and the cell are where they are on screen', () => {
      const { button, onDrag } = renderDrawn(0.5);
      press(button('c'), 125);
      move(40, { clientY: 5 });
      expect(onDrag.mock.calls.at(-1)![0]).toMatchObject({
        beforeKey: 'b',
        line: { x: 50 },
        cell: { left: 100, right: 150 },
      });
    });

    it('reports every move, even one that keeps the drop', () => {
      const { button, onDrag } = renderDrawn();
      press(button('b'), 150);
      move(260, { clientY: 5 });
      move(270, { clientY: 5 });
      move(280, { clientY: 5 });
      expect(onDrag.mock.calls.map(([d]) => d.clientX)).toEqual([260, 270, 280]);
    });

    it('then reports null once at the release, and nothing for the release itself', () => {
      const { button, onDrag, onMove } = renderDrawn();
      press(button('b'), 150);
      move(290, { clientY: 5 });
      const reported = onDrag.mock.calls.length;
      release();
      expect(onDrag.mock.calls.slice(reported)).toEqual([[null]]);
      expect(onMove).toHaveBeenCalledWith('b', null);
    });

    it('⚠️ reports null for the first move before a second press reports anything', () => {
      const { button, onDrag } = renderDrawn();
      press(button('b'), 150);
      move(290, { clientY: 5 });
      const reported = onDrag.mock.calls.length;
      press(button('c'), 250);
      expect(onDrag.mock.calls.slice(reported)).toEqual([[null]]);
    });

    it('⚠️ reports null when the header goes mid-move', () => {
      const { button, onDrag, unmount } = renderDrawn();
      press(button('b'), 150);
      move(290, { clientY: 5 });
      const reported = onDrag.mock.calls.length;
      unmount();
      move(200, { clientY: 5 });
      expect(onDrag.mock.calls.slice(reported)).toEqual([[null]]);
    });

    it('marks the moved column’s cell from the threshold to the end', () => {
      const { button, moving } = renderDrawn();
      press(button('b'), 150);
      move(290, { clientY: 5 });
      expect(moving()).toEqual(['Beta']);
      release();
      expect(moving()).toEqual([]);
    });

    it('marks the cell without `onDrag` too', () => {
      const { header, button } = renderMovable();
      fireEvent.mouseDown(button('b'), { button: 0, clientX: 150, clientY: 5 });
      move(290, { clientY: 5 });
      expect([...header.querySelectorAll('[data-table-moving]')].map((c) => c.textContent)).toEqual(['Beta']);
    });

    it('inside a grid, reports the grid’s scroller, and again when a scroll under a still pointer moves the drop', () => {
      const onDrag = vi.fn();
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
              move={{ refusePress: () => false, threshold: 4, targets, onMove: vi.fn(), onDrag }}
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
      press(cells[1]!.querySelector('button')!, 150);
      move(240, { clientY: 5 });
      expect(onDrag.mock.calls.at(-1)![0].beforeKey).toBeUndefined();
      expect(onDrag.mock.calls.at(-1)![0].scroller).toBe(scroller);
      act(() => {
        scrolled = 100;
        fireEvent.scroll(scroller);
      });
      expect(onDrag.mock.calls.at(-1)![0]).toMatchObject({
        beforeKey: null,
        clientX: 240,
        cell: { left: 100, right: 200 },
      });
      expect(onDrag.mock.calls.at(-1)![0].scroller).toBe(scroller);
    });

    it('draws no landing line', () => {
      const { button, indicator, onMove } = renderDrawn();
      press(button('b'), 150);
      move(290, { clientY: 5 });
      expect(indicator()).toBeNull();
      release();
      expect(onMove).toHaveBeenCalledWith('b', null);
    });
  });
});

describe('keys on a column', () => {
  it('reach the consumer with the column they were pressed on', () => {
    const onColumnKeyDown = vi.fn();
    const { header } = renderHeader({ onColumnKeyDown });
    fireEvent.keyDown(header.querySelectorAll('button')[1]!, { key: 'ArrowRight', shiftKey: true });
    expect(onColumnKeyDown).toHaveBeenCalledTimes(1);
    const [key, event] = onColumnKeyDown.mock.calls[0]!;
    expect(key).toBe('b');
    expect(event.key).toBe('ArrowRight');
  });
});
