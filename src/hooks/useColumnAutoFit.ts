import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Auto-fit: mount a `TableRuler` for one column, read its cells' widths, unmount it — all inside the
 * calling event. The ruler exists only while measuring, so it costs nothing and duplicates no text
 * the rest of the time.
 */
export function useColumnAutoFit<K extends string>() {
  /** The column whose ruler is mounted, or `null`. */
  const [measuring, setMeasuring] = useState<K | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  /** The px that shows every row's cell unclipped, or `null` when nothing measurable was drawn. */
  const measure = (key: K): number | null => {
    flushSync(() => setMeasuring(key));
    let max = 0;
    const group = rulerRef.current?.querySelector(`[data-table-ruler="${key}"]`);
    for (const cell of Array.from(group?.children ?? [])) {
      max = Math.max(max, cell.getBoundingClientRect().width);
    }
    flushSync(() => setMeasuring(null));
    return max > 0 ? Math.ceil(max) : null;
  };

  return { measuring, rulerRef, measure };
}
