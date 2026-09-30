// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TableRow } from './TableRow.js';
import { TABLE_CELL, TABLE_GRID } from '../lib/tableClasses.js';

afterEach(cleanup);

const TEMPLATE = '100px 80px minmax(0,1fr)';
const COLUMNS = ['a', 'b'] as const;

function renderRow(props: Partial<React.ComponentProps<typeof TableRow<'a' | 'b'>>> = {}) {
  const { container } = render(
    <TableRow
      columns={COLUMNS}
      gridStyle={{ gridTemplateColumns: TEMPLATE }}
      rowIndex={4}
      cell={(key) => `cell-${key}`}
      {...props}
    />,
  );
  return container.firstElementChild as HTMLElement;
}

describe('the grid holds no spacing of its own', () => {
  it('⚠️ no `gap` and no padding on the grid — a strip between cells would belong to none', () => {
    // Tokens, not a regex, deliberately: `docs/map/territory/verification-gates.md`.
    const tokens = TABLE_GRID.split(' ').map((c) => c.replace(/^justable:/, ''));
    expect(tokens.filter((c) => c.startsWith('gap-'))).toEqual([]);
    expect(tokens.filter((c) => c.startsWith('p') && c.includes('-'))).toEqual([]);
  });

  it('every cell carries each of `TABLE_CELL`’s classes', () => {
    const cells = [...renderRow().querySelectorAll('[role="gridcell"]')];
    expect(cells).toHaveLength(COLUMNS.length);
    for (const c of cells) {
      expect(c.className.split(' ')).toEqual(expect.arrayContaining(TABLE_CELL.split(' ')));
    }
  });
});

describe('a row', () => {
  it('is a grid row at its absolute position, with one positioned cell per column', () => {
    const row = renderRow();
    expect(row.getAttribute('role')).toBe('row');
    expect(row.getAttribute('aria-rowindex')).toBe('4');
    expect([...row.children].map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2']);
    expect(row.textContent).toBe('cell-acell-b');
  });

  it('⚠️ an outside style merges under the template and never replaces it', () => {
    const row = renderRow({
      style: { position: 'absolute', top: 56, gridTemplateColumns: '1px' },
    });
    expect(row.style.gridTemplateColumns).toBe(TEMPLATE);
    expect(row.style.position).toBe('absolute');
    expect(row.style.top).toBe('56px');
  });

  it('passes the rest through to the row element', () => {
    const row = renderRow({ id: 'r-1', 'aria-selected': false, className: 'extra' });
    expect(row.id).toBe('r-1');
    expect(row.getAttribute('aria-selected')).toBe('false');
    expect(row.className.split(' ')).toEqual(expect.arrayContaining(['justable:grid', 'extra']));
  });

  it('gives a cell its class and title when asked', () => {
    const row = renderRow({
      cellClassName: (key) => (key === 'b' ? 'text-right' : undefined),
      cellTitle: (key) => (key === 'b' ? 'full value' : undefined),
    });
    const [a, b] = [...row.children] as HTMLElement[];
    expect(b.className.split(' ')).toContain('text-right');
    expect(b.title).toBe('full value');
    expect(a.hasAttribute('title')).toBe(false);
  });
});
