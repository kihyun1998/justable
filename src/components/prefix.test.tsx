// @vitest-environment jsdom
/**
 * Every class the engine renders carries the `justable:` prefix. The package's stylesheet is built
 * with that prefix, so an unprefixed class gets no CSS at all — the element silently loses its
 * layout. Consumer classes are the consumer's and are left out of these renders.
 */
import { cleanup, render } from '@testing-library/react';
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

  it('in the ruler', () => {
    const { container } = render(<TableRuler column="a" rows={['x']} cell={(r) => r} />);
    expect(unprefixed(container)).toEqual([]);
  });
});
