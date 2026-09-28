/** The grid's scroller, handed from `TableGrid` to the header it draws. `null` outside a grid. */
import { createContext } from 'react';
import type { RefObject } from 'react';

export const GridScrollerContext = createContext<RefObject<HTMLElement | null> | null>(null);
