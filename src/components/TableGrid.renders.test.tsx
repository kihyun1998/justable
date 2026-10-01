// @vitest-environment jsdom
/**
 * When the grid renders: what it draws changing is the only reason. Commits are counted with a
 * React `Profiler` over a measured grid — a 280 px viewport and 28 px rows (`rowHeightRem` 1.75 at
 * the 16 px fallback, since jsdom gives no row a box).
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Profiler, type ProfilerOnRenderCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type RowPlace, TableGrid } from './TableGrid.js';
import { visibleRange } from '../lib/rowWindow.js';

const ROW = 28;
let viewport = 280;
let observers: ResizeObserverCallback[] = [];
const restore: (() => void)[] = [];

beforeEach(() => {
  viewport = 280;
  observers = [];
  const proto = HTMLElement.prototype;
  for (const name of ['clientHeight', 'offsetHeight'] as const) {
    const original = Object.getOwnPropertyDescriptor(proto, name);
    Object.defineProperty(proto, name, {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-scroller') ? viewport : 0;
      },
    });
    restore.push(() => {
      if (original) Object.defineProperty(proto, name, original);
      else delete (proto as unknown as Record<string, unknown>)[name];
    });
  }
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      observers.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  restore.push(() => {
    globalThis.ResizeObserver = original;
  });
});

afterEach(() => {
  cleanup();
  while (restore.length) restore.pop()!();
});

function renderGrid(total: number) {
  const phases: string[] = [];
  const onRender: ProfilerOnRenderCallback = (_id, phase) => {
    phases.push(phase);
  };
  const grid = (n: number, rem = ROW / 16) => (
    <Profiler id="grid" onRender={onRender}>
      <TableGrid
        label="Things"
        header={<div role="row" aria-rowindex={1} />}
        colCount={1}
        total={n}
        rowKey={(i) => `r${i}`}
        renderRow={(i: number, place: RowPlace) => (
          <div role="row" id={place.id} data-row={i} style={place.style} />
        )}
        fill
        focus={null}
        rowIdPrefix="t"
        rowHeightRem={rem}
        scrollerProps={{ 'data-scroller': true }}
      />
    </Profiler>
  );
  const { container, rerender } = render(grid(total));
  const scroller = container.querySelector('[data-scroller]') as HTMLElement;
  return {
    phases,
    scroller,
    rerender: (n: number, rem?: number) => rerender(grid(n, rem)),
    scrollTo: (top: number) => {
      scroller.scrollTop = top;
      fireEvent.scroll(scroller);
    },
    drawn: () => {
      const rows = [...container.querySelectorAll('[data-row]')].map((r) => Number(r.getAttribute('data-row')));
      return { start: rows[0], end: rows[rows.length - 1]! + 1 };
    },
  };
}

const windowAt = (scrollTop: number, total: number, rowHeight = ROW) =>
  visibleRange({ scrollTop, viewportHeight: viewport, rowHeight, total });

describe('scrolling', () => {
  it('⚠️ renders only on a step that moves the drawn window, and never a second time', () => {
    const { phases, scrollTo, drawn } = renderGrid(5_000);
    phases.length = 0;

    let moved = 0;
    let before = windowAt(0, 5_000);
    for (let step = 1; step <= 400; step += 1) {
      act(() => scrollTo(step * 25));
      const now = windowAt(step * 25, 5_000);
      if (now.start !== before.start || now.end !== before.end) moved += 1;
      before = now;
    }

    expect(phases.filter((p) => p === 'nested-update')).toEqual([]);
    expect(moved).toBeGreaterThan(30);
    expect(moved).toBeLessThan(60);
    expect(phases.length).toBe(moved);
    expect(drawn()).toEqual(windowAt(400 * 25, 5_000));
  });
});

describe('a commit with nothing to measure differently', () => {
  /**
   * ⚠️ One rerender is not enough to see it: a state updater is bailed out of without a render when
   * the grid has no update pending, which holds on every other rerender.
   */
  it('⚠️ is not followed by a second render', () => {
    const { phases, rerender } = renderGrid(5_000);
    phases.length = 0;
    for (let i = 0; i < 4; i += 1) rerender(5_000);
    expect(phases).toEqual(['update', 'update', 'update', 'update']);
  });

  it('a first measurement renders once more, and only once', () => {
    const { phases } = renderGrid(5_000);
    expect(phases).toEqual(['mount', 'nested-update']);
  });
});

describe('the window follows what it is computed from, without a scroll event', () => {
  it('a resize recomputes it', () => {
    const { scrollTo, drawn } = renderGrid(5_000);
    act(() => scrollTo(3_100));
    viewport = 900;
    act(() => {
      for (const observe of observers) observe([], {} as ResizeObserver);
    });
    expect(drawn()).toEqual(windowAt(3_100, 5_000));
  });

  /**
   * ⚠️ 3,100 px is in the block 3,000 px drew at 28 px rows, so that step renders nothing. At 16 px
   * rows the two offsets are in different blocks (rows 184 and 192), so only a window computed from
   * the offset now is right.
   */
  it('a new row height recomputes it from the offset now, not the last one drawn', () => {
    const { scrollTo, rerender, drawn, phases } = renderGrid(5_000);
    act(() => scrollTo(3_000));
    phases.length = 0;
    act(() => scrollTo(3_100));
    expect(phases).toEqual([]);
    rerender(5_000, 1);
    expect(drawn()).toEqual(windowAt(3_100, 5_000, 16));
    expect(windowAt(3_100, 5_000, 16)).not.toEqual(windowAt(3_000, 5_000, 16));
  });

  it('a new total recomputes it from the offset now', () => {
    const { scrollTo, rerender, drawn } = renderGrid(5_000);
    act(() => scrollTo(3_000));
    act(() => scrollTo(3_100));
    rerender(112);
    expect(drawn()).toEqual(windowAt(3_100, 112));
  });
});
