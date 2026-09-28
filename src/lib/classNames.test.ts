import { describe, expect, it } from 'vitest';

import { classNames } from './classNames.js';

describe('classNames', () => {
  it('joins the truthy parts with one space', () => {
    expect(classNames('grid', 'items-center')).toBe('grid items-center');
  });

  it('drops false, null, undefined and empty strings', () => {
    expect(classNames('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('keeps both of two conflicting utilities — it resolves nothing', () => {
    expect(classNames('bg-border', 'bg-primary')).toBe('bg-border bg-primary');
  });

  it('is empty for nothing', () => {
    expect(classNames()).toBe('');
    expect(classNames(false, undefined)).toBe('');
  });
});
