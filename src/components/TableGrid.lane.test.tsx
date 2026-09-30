// @vitest-environment jsdom
/**
 * The grid's header lane and empty-gutter spacer, against stubbed lengths: a scroller 300 px wide
 * inside 315 (a 15 px gutter), with 500 px of content. Every element, the engine probe included,
 * reports content wider than itself and a `scrollLeft` of 0, so the probe answers that this
 * document withholds the gutter. These lengths are the only ones this file uses:
 * `docs/map/territory/verification-gates.md`.
 */
import { act, cleanup, render } from '@testing-library/react';
import { Profiler, useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type GridScroller, GridScrollerContext } from './gridScroller.js';
import { TableGrid } from './TableGrid.js';

const GUTTER = 15;
const VIEW_WIDTH = 300;
let content = 500;
let viewHeight = 0;
let restore: (() => void)[] = [];

const isScroller = (el: HTMLElement) => el.hasAttribute('data-scroller');

function stub(name: string, get: (el: HTMLElement) => number) {
  const proto = HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, name);
  Object.defineProperty(proto, name, {
    configurable: true,
    get(this: HTMLElement) {
      return get(this);
    },
    set() {},
  });
  restore.push(() => {
    if (original) Object.defineProperty(proto, name, original);
    else delete (proto as unknown as Record<string, unknown>)[name];
  });
}

beforeEach(() => {
  content = 500;
  stub('offsetWidth', (el) => (isScroller(el) ? VIEW_WIDTH + GUTTER : 0));
  stub('clientWidth', (el) => (isScroller(el) ? VIEW_WIDTH : 100));
  stub('clientHeight', (el) => (isScroller(el) ? viewHeight : 0));
  stub('scrollHeight', (el) => (isScroller(el) ? viewHeight : 0));
  stub('scrollWidth', () => content);
  // Scrolled to its end, the probe stays at 0: the engine withholds the gutter.
  stub('scrollLeft', () => 0);
});

afterEach(() => {
  cleanup();
  for (const undo of restore.reverse()) undo();
  restore = [];
});

function renderGrid(keyboard?: { rowsPerPage: number }, onCommit?: () => void) {
  const held: { grid: GridScroller | null } = { grid: null };
  function Header() {
    held.grid = useContext(GridScrollerContext);
    return <div role="row" aria-rowindex={1} />;
  }
  const { container } = render(
    <Profiler id="grid" onRender={() => onCommit?.()}>
      <TableGrid
        label="Things"
        header={<Header />}
        colCount={1}
        total={40}
        rowKey={(i) => `r${i}`}
        renderRow={(i, place) => <div role="row" id={place.id} data-row={`r${i}`} style={place.style} />}
        fill
        focus={null}
        rowIdPrefix="t"
        rowHeightRem={1.75}
        scrollerProps={{ 'data-scroller': true }}
        keyboard={keyboard}
      />
    </Profiler>,
  );
  const [lane, scroller] = container.querySelectorAll<HTMLElement>('[role="grid"] > [role="rowgroup"]');
  return { lane: lane!, spacer: scroller!.lastElementChild as HTMLElement, held };
}

describe('the header lane', () => {
  it('⚠️ pads the gutter while the scroller has no height, and leaves the spacer alone', () => {
    viewHeight = 0;
    const { lane, spacer } = renderGrid();
    expect(lane.style.paddingRight).toBe(`${GUTTER}px`);
    expect(spacer.style.width).toBe('');
    expect(spacer.style.display).toBe('');
  });

  it('extends the content by the gutter once the scroller has a height', () => {
    viewHeight = 200;
    const { lane, spacer } = renderGrid();
    expect(lane.style.paddingRight).toBe(`${GUTTER}px`);
    expect(spacer.style.width).toBe(`${content + GUTTER}px`);
    expect(spacer.style.display).toBe('block');
  });
});

describe('releasing the width hold', () => {
  it('⚠️ re-measures the spacer with no commit of the grid', () => {
    viewHeight = 200;
    let commits = 0;
    const { spacer, held } = renderGrid(undefined, () => (commits += 1));
    const before = commits;

    act(() => held.grid!.holdWidth(true));
    content = 440;
    act(() => held.grid!.holdWidth(false));

    expect(commits).toBe(before);
    expect(spacer.style.width).toBe(`${440 + GUTTER}px`);
  });

  it('⚠️ re-measures the row box', () => {
    viewHeight = 200;
    const link = { rowsPerPage: 0 };
    const { held } = renderGrid(link);
    expect(link.rowsPerPage).toBe(Math.floor(200 / 28));

    act(() => held.grid!.holdWidth(true));
    viewHeight = 280;
    act(() => held.grid!.holdWidth(false));

    expect(link.rowsPerPage).toBe(Math.floor(280 / 28));
  });
});
