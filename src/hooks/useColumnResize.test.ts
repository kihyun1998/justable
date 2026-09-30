// @vitest-environment jsdom
/**
 * The border drag's hook, called by a consumer that draws its own handle.
 */
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useColumnResize } from './useColumnResize.js';

afterEach(cleanup);

function renderResize() {
  const onResize = vi.fn();
  const onDrag = vi.fn();
  const { result } = renderHook(() => useColumnResize<'a'>(onResize, onDrag));
  return { result, onResize, onDrag };
}

describe('a drag begun without its button', () => {
  it('ends at any button’s release', () => {
    const { result, onDrag } = renderResize();
    act(() => result.current.begin('a', 100, 0));
    act(() => {
      fireEvent.mouseUp(document, { button: 2 });
    });
    expect(onDrag).toHaveBeenLastCalledWith(null);
    expect(result.current.resizing).toBeNull();
  });

  it('follows a move whatever its `buttons` say', () => {
    const { result, onResize } = renderResize();
    act(() => result.current.begin('a', 100, 0));
    act(() => {
      fireEvent.mouseMove(document, { clientX: 30, buttons: 0 });
    });
    expect(onResize).toHaveBeenLastCalledWith('a', 130);
    expect(result.current.resizing).toBe('a');
  });
});

describe('a drag begun with its button', () => {
  it('ends only at that button’s release', () => {
    const { result, onDrag } = renderResize();
    act(() => result.current.begin('a', 100, 0, 1, null, undefined, 2));
    act(() => {
      fireEvent.mouseUp(document, { button: 0 });
    });
    expect(onDrag).not.toHaveBeenCalledWith(null);
    act(() => {
      fireEvent.mouseUp(document, { button: 2 });
    });
    expect(onDrag).toHaveBeenLastCalledWith(null);
  });
});
