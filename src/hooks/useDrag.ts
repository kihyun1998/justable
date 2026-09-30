import { useEffect, useRef } from 'react';

/** `MouseEvent.button` → its bit in `MouseEvent.buttons`. */
const BUTTON_BIT = [1, 4, 2, 8, 16];

/** Why a running drag was ended from outside it: another drag began, or its component unmounted. */
export type DragInterruption = 'replaced' | 'unmounted';

/** One drag's side of its lifetime. */
export interface DragHandlers {
  /** A `document` mousemove while the drag runs. */
  move: (event: MouseEvent) => void;
  /** The drag's release; the drag ends right after it. */
  release: (event: MouseEvent) => void;
  /** The scroller scrolled while the drag runs. */
  scroll?: () => void;
  /** The drag is being ended from outside, before its listeners go. */
  interrupted?: (why: DragInterruption) => void;
  /** The drag has ended, however it ended; its listeners are gone. */
  ended?: () => void;
}

/**
 * The lifetime of a mouse drag: `document` mousemove and mouseup and the scroller's scroll from
 * `begin` until the release, with at most one drag running and none outliving the component. The
 * rules: `docs/map/territory/drag-lifetime.md`.
 */
export function useDrag() {
  /** Ends the running drag from outside; `null` while none runs. */
  const running = useRef<((why: DragInterruption) => void) | null>(null);

  useEffect(
    () => () => {
      running.current?.('unmounted');
    },
    [],
  );

  /**
   * Starts a drag: ends any running one, then asks `start` for the new one's handlers, handing it
   * what ends the drag from inside, with no release. Given the `button` that pressed, only that
   * button's mouseup releases it, and a move whose `buttons` no longer hold that button releases it
   * too; without one, any mouseup releases it.
   */
  const begin = (
    button: number | undefined,
    scroller: HTMLElement | null,
    start: (end: () => void) => DragHandlers,
  ) => {
    running.current?.('replaced');
    const held = button === undefined ? undefined : (BUTTON_BIT[button] ?? 0);

    const onMove = (ev: MouseEvent) => {
      if (held !== undefined && (ev.buttons & held) === 0) release(ev);
      else drag.move(ev);
    };
    const onUp = (ev: MouseEvent) => {
      if (button === undefined || ev.button === button) release(ev);
    };
    const onScroll = () => drag.scroll?.();
    const release = (ev: MouseEvent) => {
      drag.release(ev);
      end();
    };
    const end = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      scroller?.removeEventListener('scroll', onScroll);
      running.current = null;
      drag.ended?.();
    };
    const interrupt = (why: DragInterruption) => {
      drag.interrupted?.(why);
      end();
    };
    const drag = start(end);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    scroller?.addEventListener('scroll', onScroll);
    running.current = interrupt;
  };

  return { begin };
}
