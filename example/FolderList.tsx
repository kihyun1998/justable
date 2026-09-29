import { scrollToReveal, useTypeAhead, visibleRange } from '@kihyun1998/justable';
import { useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const ROW_PX = 28;

/**
 * A list that is not the grid: its own movement (↑ ↓ Home End), the engine's type-ahead through
 * `useTypeAhead`, and the engine's windowing functions. It calls `end()` on every move of its own,
 * which the hook cannot see.
 */
export function FolderList({
  names,
  onStatus,
}: {
  names: readonly string[];
  onStatus: (text: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const typeAhead = useTypeAhead();

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const moveTo = (index: number) => {
    setCursor(index);
    onStatus(`folder: ${names[index]}`);
    const el = scroller.current;
    if (!el) return;
    const next = scrollToReveal(index, {
      scrollTop: el.scrollTop,
      viewportHeight: el.clientHeight,
      rowHeight: ROW_PX,
    });
    if (next !== null) el.scrollTop = next;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = names.length - 1;
    const moves: Record<string, number | undefined> = {
      ArrowDown: cursor === null ? 0 : Math.min(last, cursor + 1),
      ArrowUp: cursor === null ? 0 : Math.max(0, cursor - 1),
      Home: 0,
      End: last,
    };
    const to = moves[e.key];
    if (to !== undefined) {
      e.preventDefault();
      typeAhead.end();
      moveTo(to);
      return;
    }
    const answer = typeAhead.step(e, { focus: cursor, names });
    if (answer?.to != null) moveTo(answer.to);
    else if (answer) onStatus('type-ahead: no match');
  };

  const { start, end } = visibleRange({
    scrollTop,
    viewportHeight: viewport,
    rowHeight: ROW_PX,
    total: names.length,
  });

  const items = [];
  for (let i = start; i < end; i += 1) {
    items.push(
      <div
        key={names[i]}
        id={`folder-${i}`}
        role="option"
        aria-selected={cursor === i}
        className={cursor === i ? 'list-item is-cursor' : 'list-item'}
        style={{ top: i * ROW_PX }}
        onClick={() => moveTo(i)}
      >
        <span className="truncate">📁 {names[i]}</span>
      </div>,
    );
  }

  return (
    <div
      ref={scroller}
      className="list"
      role="listbox"
      aria-label="Folders"
      tabIndex={0}
      aria-activedescendant={cursor !== null && cursor >= start && cursor < end ? `folder-${cursor}` : undefined}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ position: 'relative', height: names.length * ROW_PX }}>{items}</div>
    </div>
  );
}
