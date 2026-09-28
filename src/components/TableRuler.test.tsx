// @vitest-environment jsdom
/**
 * What jsdom can check about the ruler: its shape. Where widths are checked:
 * `docs/map/territory/verification-gates.md`.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TableRuler } from './TableRuler.js';
import { useColumnAutoFit } from '../hooks/useColumnAutoFit.js';

afterEach(cleanup);

const ROWS = ['alpha', 'beta', 'gamma'];

describe('TableRuler', () => {
  it('draws the one column it measures, with a cell per row', () => {
    const { container } = render(<TableRuler column="name" rows={ROWS} cell={(row) => row} />);
    const groups = [...container.querySelectorAll('[data-table-ruler]')];
    expect(groups.map((g) => g.getAttribute('data-table-ruler'))).toEqual(['name']);
    expect(groups[0]!.children).toHaveLength(ROWS.length);
  });

  /**
   * RTL's text queries do not skip `aria-hidden` or `inert`, so a ruler left mounted doubles every
   * row's text.
   */
  it('⚠️ a mounted ruler is found by text queries — so it must not stay mounted', () => {
    render(<TableRuler column="name" rows={ROWS} cell={(row) => row} />);
    expect(screen.getAllByText('alpha').length).toBeGreaterThan(0);
  });
});

describe('useColumnAutoFit', () => {
  it('mounts nothing until asked, and nothing after', () => {
    const { result } = renderHook(() => useColumnAutoFit<'name'>());
    expect(result.current.measuring).toBeNull();
    act(() => {
      result.current.measure('name');
    });
    expect(result.current.measuring).toBeNull();
  });

  it('answers null when nothing measurable was drawn, never a width of zero', () => {
    const { result } = renderHook(() => useColumnAutoFit<'name'>());
    let px: number | null = 0;
    act(() => {
      px = result.current.measure('name');
    });
    expect(px).toBeNull();
  });
});
