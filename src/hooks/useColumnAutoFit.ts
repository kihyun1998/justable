import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

/**
 * Auto-fit: mount a `TableRuler` for the columns asked about, read its cells' widths, unmount it — all
 * inside the calling event, so `measure` and `measureAll` are called from an event handler. Why the
 * ruler exists only while measuring: `docs/map/territory/auto-fit.md`.
 */
export function useColumnAutoFit<K extends string>() {
  /** The column, or the columns, whose ruler is mounted, or `null`. */
  const [measuring, setMeasuring] = useState<K | readonly K[] | null>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  /** The widest cell of one mounted group, rounded up, or `null` when it drew nothing measurable. */
  const widest = (key: K): number | null => {
    let max = 0;
    const groups = Array.from(rulerRef.current?.children ?? []);
    const group = groups.find((g) => g.getAttribute('data-table-ruler') === key);
    for (const cell of Array.from(group?.children ?? [])) {
      max = Math.max(max, cell.getBoundingClientRect().width);
    }
    return max > 0 ? Math.ceil(max) : null;
  };

  /** The px that shows every row's cell unclipped, or `null` when nothing measurable was drawn. */
  const measure = (key: K): number | null => {
    flushSync(() => setMeasuring(key));
    try {
      return widest(key);
    } finally {
      flushSync(() => setMeasuring(null));
    }
  };

  /** `measure` for each distinct key of `keys`, from one mount of the ruler. */
  const measureAll = <T extends K>(keys: readonly T[]): Record<T, number | null> => {
    const distinct = [...new Set(keys)];
    const answer = {} as Record<T, number | null>;
    if (distinct.length === 0) return answer;
    flushSync(() => setMeasuring(distinct));
    try {
      for (const key of distinct) answer[key] = widest(key);
    } finally {
      flushSync(() => setMeasuring(null));
    }
    return answer;
  };

  return { measuring, rulerRef, measure, measureAll };
}
