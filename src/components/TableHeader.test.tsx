// @vitest-environment jsdom
/**
 * The engine's header on its own columns. The Explorer's composed header — labels, hiding — is
 * `blocks/explorer/components/ExplorerTableHeader.aria.test.tsx`.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const move = (x: number) =>
  act(() => {
    fireEvent.mouseMove(document, { clientX: x });
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

  it('a consumer predicate that allows lets any press arm — the engine holds no button rule', () => {
    const onResize = vi.fn();
    const { header } = renderHeader({ onResize, refusePress: () => false });
    press(header, 2);
    move(30);
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

  it('the sorted column alone carries `aria-sort` and an arrow', () => {
    const { header } = renderHeader({ sort: { key: 'b', desc: true } });
    const cells = [...header.querySelectorAll('[role="columnheader"]')];
    expect(cells.map((c) => c.getAttribute('aria-sort'))).toEqual([null, 'descending']);
    expect(cells.map((c) => c.querySelector('svg') !== null)).toEqual([false, true]);
  });
});
