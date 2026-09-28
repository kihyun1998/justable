// @vitest-environment jsdom
/**
 * Every class the engine renders carries the `justable:` prefix. The package's stylesheet is built
 * with that prefix, so an unprefixed class gets no CSS at all — the element silently loses its
 * layout. Consumer classes are the consumer's and are left out of these renders.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TableGrid } from './TableGrid.js';
import { TableHeader } from './TableHeader.js';
import { TableRow } from './TableRow.js';
import { TableRuler } from './TableRuler.js';

afterEach(cleanup);

const unprefixed = (root: Element) =>
  [root, ...root.querySelectorAll('*')].flatMap((el) =>
    (el.getAttribute('class') ?? '')
      .split(/\s+/)
      // `lucide*` are the icon set's own markers on its SVGs, with no stylesheet behind them.
      .filter((c) => c !== '' && !c.startsWith('justable:') && !c.startsWith('lucide')),
  );

const HEADER = (
  <TableHeader
    columns={[{ key: 'a', label: 'A', width: 80 }]}
    sort={{ key: 'a', desc: false }}
    gridStyle={{}}
    onSort={vi.fn()}
    onResize={vi.fn()}
    resizeLabel="Resize"
    refusePress={() => false}
  />
);

describe('every engine class is prefixed', () => {
  it('in the grid, its header and a row', () => {
    const { container } = render(
      <TableGrid
        label="t"
        header={HEADER}
        colCount={1}
        total={2}
        rowKey={(i) => String(i)}
        renderRow={(i, place) => (
          <TableRow
            columns={['a']}
            gridStyle={{}}
            rowIndex={place.rowIndex}
            cell={() => `row ${i}`}
          />
        )}
        fill={false}
        focus={0}
        rowIdPrefix="t"
        rowHeightRem={1.75}
        disabled
      />,
    );
    expect(unprefixed(container)).toEqual([]);
  });

  it('in the grid when it fills and is enabled', () => {
    const { container } = render(
      <TableGrid
        label="t"
        header={HEADER}
        colCount={1}
        total={0}
        rowKey={(i) => String(i)}
        renderRow={() => null}
        fill
        focus={null}
        rowIdPrefix="t"
        rowHeightRem={1.75}
      />,
    );
    expect(unprefixed(container)).toEqual([]);
  });

  it('in the header while a border is dragged', () => {
    const { container } = render(HEADER);
    fireEvent.mouseDown(container.querySelector('[data-table-resize="a"]')!, { button: 0 });
    // The drawn line has switched to its active colour: the branch this case exists to render.
    expect(container.querySelector('[data-table-resize="a"] span')!.className).toContain(
      'resize-line-active',
    );
    expect(unprefixed(container)).toEqual([]);
    fireEvent.mouseUp(document);
  });

  it('in the ruler', () => {
    const { container } = render(<TableRuler column="a" rows={['x']} cell={(r) => r} />);
    expect(unprefixed(container)).toEqual([]);
  });
});
