// @vitest-environment jsdom
/**
 * The README's quick start: that it is this file, verbatim, and that it draws a working table.
 */
import fs from 'node:fs';

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { People } from './QuickStart.js';

afterEach(cleanup);

const read = (file: string) =>
  fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('the README quick start', () => {
  it('is example/QuickStart.tsx, character for character', () => {
    const readme = read('../README.md');
    const block = /## Quick start\n[\s\S]*?```tsx\n([\s\S]*?)```/.exec(readme)?.[1];
    expect(block, 'no tsx block under ## Quick start').toBeDefined();
    expect(block).toBe(read('./QuickStart.tsx'));
  });

  const PEOPLE = [
    { name: 'Ada', age: 36 },
    { name: 'Grace', age: 85 },
    { name: 'Alan', age: 41 },
  ];

  it('draws a header and one row per person', () => {
    const { container } = render(<People people={PEOPLE} />);
    const grid = container.querySelector('[role="grid"]')!;
    expect([...grid.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent)).toEqual([
      'Name',
      'Age',
    ]);
    expect(grid.querySelectorAll('[role="row"][aria-rowindex]').length).toBe(1 + PEOPLE.length);
  });

  it('sorts from the header and moves with the keyboard', () => {
    const { container } = render(<People people={PEOPLE} />);
    const grid = container.querySelector('[role="grid"]') as HTMLElement;
    const names = () =>
      [...grid.querySelectorAll('[role="row"]:not([data-table-header])')].map(
        (r) => r.querySelector('[role="gridcell"]')!.textContent,
      );
    fireEvent.click(grid.querySelectorAll('[role="columnheader"] button')[1]!);
    expect(names()).toEqual(['Grace', 'Alan', 'Ada']);

    act(() => {
      fireEvent.keyDown(grid, { key: 'ArrowDown' });
    });
    expect(grid.getAttribute('aria-activedescendant')).toBe('people-row-0');
  });
});
