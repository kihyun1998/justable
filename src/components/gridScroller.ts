/**
 * What `TableGrid` hands the header it draws: its scroller, and a hold on its content's width for the
 * length of a border drag. `null` outside a grid.
 */
import { createContext } from 'react';
import type { RefObject } from 'react';

export interface GridScroller {
  scrollerRef: RefObject<HTMLElement | null>;
  /** `true`: the content keeps at least its widest width so far; `false`: lets it go. */
  holdWidth: (on: boolean) => void;
}

export const GridScrollerContext = createContext<GridScroller | null>(null);
