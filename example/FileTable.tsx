import {
  TableGrid,
  TableHeader,
  TableRow,
  TableRuler,
  createTableModel,
  useColumnAutoFit,
  useTableKeyboard,
  type ColumnLayout,
  type ColumnSpec,
  type MarqueeReport,
  type TableSort,
} from '@kihyun1998/justable';
import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import type { Modifiers } from './App.js';
import { useEdgeScroll } from './edgeScroll.js';
import { formatSize, type FileEntry } from './files.js';

type Key = 'name' | 'kind' | 'size' | 'modified';
type Hideable = Exclude<Key, 'name'>;

const LABELS: Record<Key, string> = { name: 'Name', kind: 'Kind', size: 'Size', modified: 'Modified' };

const SPEC: ColumnSpec<FileEntry, Key>[] = [
  {
    key: 'name',
    defaultWidth: 260,
    minWidth: 120,
    maxWidth: 720,
    hideable: false,
    firstSortDesc: false,
    compare: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
  },
  {
    key: 'kind',
    defaultWidth: 90,
    minWidth: 60,
    maxWidth: 200,
    hideable: true,
    firstSortDesc: false,
    compare: (a, b) => a.kind.localeCompare(b.kind),
  },
  {
    key: 'size',
    defaultWidth: 100,
    minWidth: 70,
    maxWidth: 200,
    hideable: true,
    firstSortDesc: true,
    compare: (a, b) => a.size - b.size,
  },
  {
    key: 'modified',
    defaultWidth: 130,
    minWidth: 90,
    maxWidth: 260,
    hideable: true,
    firstSortDesc: true,
    compare: (a, b) => a.modified.getTime() - b.modified.getTime(),
  },
];

const model = createTableModel<FileEntry, Key, Hideable>(SPEC);

function cellOf(file: FileEntry, key: Key): ReactNode {
  switch (key) {
    case 'name':
      return <span className="truncate file-name" data-name>{file.kind === 'folder' ? `📁 ${file.name}` : file.name}</span>;
    case 'kind':
      return file.kind;
    case 'size':
      return formatSize(file.size);
    case 'modified':
      return file.modified.toISOString().slice(0, 10);
  }
}

const cellClass = (key: Key) =>
  key === 'size' ? 'cell-num cell-muted' : key === 'name' ? undefined : 'cell-muted';

export function FileTable({
  files,
  disabled,
  parentRow = false,
  onStatus,
}: {
  files: readonly FileEntry[];
  disabled: boolean;
  /** A `..` row drawn above the files, through `leadingRows`. */
  parentRow?: boolean;
  onStatus: (text: string) => void;
}) {
  const [layout, setLayout] = useState<ColumnLayout<Key, Hideable>>({ widths: {}, hidden: [] });
  const [sort, setSort] = useState<TableSort<Key> | undefined>({ key: 'name', desc: false });
  const [focus, setFocus] = useState<number | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const keyboard = useTableKeyboard({ windowMs: 700 });
  const autoFit = useColumnAutoFit<Key>();

  const rows = useMemo(() => model.sortRows(files, sort), [files, sort]);
  const names = useMemo(() => rows.map((r) => r.name), [rows]);
  const columns = model.visibleColumns(layout);
  const gridStyle = { gridTemplateColumns: model.gridTemplate(layout) };

  /** Selection is the consumer's: plain picks one, Ctrl/Meta toggles, Shift extends from the anchor. */
  const pick = (index: number, mods: Modifiers) => {
    const name = names[index]!;
    if (mods.shiftKey && anchor !== null) {
      const [a, b] = anchor < index ? [anchor, index] : [index, anchor];
      setSelected(new Set(names.slice(a, b + 1)));
    } else if (mods.ctrlKey || mods.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
      setAnchor(index);
    } else {
      setSelected(new Set([name]));
      setAnchor(index);
    }
    setFocus(index);
    onStatus(`focus: ${name}`);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const answer = keyboard.step(e, { focus, names });
    if (answer === null) {
      // Not the table's key: Space is the keyboard's click, the rest is ignored here.
      if (e.key === ' ' && focus !== null) {
        e.preventDefault();
        pick(focus, e);
      }
      return;
    }
    if (answer.to === null) {
      onStatus('type-ahead: no match');
      return;
    }
    if (answer.by === 'typeAhead') pick(answer.to, { shiftKey: false, ctrlKey: false, metaKey: false });
    else if (e.ctrlKey || e.metaKey) setFocus(answer.to);
    else pick(answer.to, e);
  };

  const onResizeDrag = useEdgeScroll('x');
  const edgeScrollMarquee = useEdgeScroll('xy');
  /** The selection when the marquee started, which every report is laid over. */
  const before = useRef<ReadonlySet<string>>(new Set());

  /**
   * The marquee's rows laid over the selection it started from: plain replaces it, Ctrl/Meta toggles
   * the rows it touches, Shift adds them. Escape puts the selection back.
   */
  const onMarquee = ({ phase, range, event, scroller }: MarqueeReport) => {
    if (phase === 'start') before.current = selected;
    const running = phase === 'start' || phase === 'move';
    edgeScrollMarquee(running ? { clientX: event.clientX, clientY: event.clientY, scroller } : null);
    if (phase === 'cancel') {
      setSelected(before.current);
      return;
    }
    const low = range ? Math.min(range.anchor, range.head) : 0;
    const touched = range ? names.slice(low, low + Math.abs(range.head - range.anchor) + 1) : [];
    let next: Set<string>;
    if (event.ctrlKey || event.metaKey) {
      next = new Set(before.current);
      for (const name of touched) {
        if (next.has(name)) next.delete(name);
        else next.add(name);
      }
    } else if (event.shiftKey) {
      next = new Set([...before.current, ...touched]);
    } else {
      next = new Set(touched);
    }
    setSelected(next);
    if (phase === 'end' && range) {
      setAnchor(range.anchor);
      setFocus(range.head);
      onStatus(`marquee: ${touched.length} rows`);
    }
  };

  const onAutoFit = (key: Key) => {
    const px = autoFit.measure(key);
    if (px !== null) setLayout((l) => model.withWidth(l, key, px));
    onStatus(px === null ? `auto-fit ${key}: nothing measured` : `auto-fit ${key}: ${px}px`);
  };

  /** Every visible column at once; a column that measured nothing keeps its width. */
  const onFitAll = () => {
    const px = autoFit.measureAll(columns);
    setLayout((l) => columns.reduce((acc, key) => {
      const w = px[key];
      return w === null ? acc : model.withWidth(acc, key, w);
    }, l));
    onStatus(`auto-fit all: ${columns.map((key) => `${key} ${px[key] === null ? '-' : px[key]}`).join(', ')}`);
  };

  const header = (
    <TableHeader
      className="header"
      columns={columns.map((key) => ({ key, label: LABELS[key], width: model.columnWidth(layout, key) }))}
      sort={sort}
      gridStyle={gridStyle}
      onSort={(key) => setSort((s) => model.nextSort(s, key))}
      onResize={(key, px) => setLayout((l) => model.withWidth(l, key, px))}
      onResizeDrag={onResizeDrag}
      onAutoFit={onAutoFit}
      resizeLabel="Resize column"
      refusePress={(e) => e.button !== 0}
    />
  );

  return (
    <>
      <div className="toolbar">
        {SPEC.filter((c) => c.hideable).map((c) => (
          <label key={c.key}>
            <input
              type="checkbox"
              checked={!model.isHidden(layout, c.key as Hideable)}
              onChange={() => setLayout((l) => model.toggleHidden(l, c.key as Hideable))}
            />
            {LABELS[c.key]}
          </label>
        ))}
        <button type="button" data-fit-all onClick={onFitAll}>
          Fit all columns
        </button>
        <span className="cell-muted">
          {selected.size} selected · double-click a column border to auto-fit
        </span>
      </div>

      {/* The table reports keys; this wrapper is the consumer's listener. */}
      <div className="pane" style={{ flex: 1 }} onKeyDown={onKeyDown}>
        <TableGrid
          label="Files"
          header={header}
          colCount={columns.length}
          total={rows.length}
          rowKey={(i) => rows[i]!.name}
          leadingRows={
            parentRow
              ? [
                  (rowIndex) => (
                    <TableRow
                      rowIndex={rowIndex}
                      columns={columns}
                      gridStyle={gridStyle}
                      className="row"
                      data-parent-row
                      cell={(key) => (key === 'name' ? '..' : null)}
                      cellClassName={cellClass}
                    />
                  ),
                ]
              : []
          }
          renderRow={(i, place) => (
            <TableRow
              id={place.id}
              rowIndex={place.rowIndex}
              style={place.style}
              columns={columns}
              gridStyle={gridStyle}
              className={place.focused ? 'row is-focused' : 'row'}
              aria-selected={selected.has(rows[i]!.name)}
              onClick={(e) => pick(i, e)}
              cell={(key) => cellOf(rows[i]!, key)}
              cellClassName={cellClass}
            />
          )}
          fill
          focus={focus}
          rowIdPrefix="files"
          disabled={disabled}
          multiselectable
          rowHeightRem={1.75}
          keyboard={keyboard.link}
          onFloorClick={() => setSelected(new Set())}
          marquee={{
            // A press on a file's name is a click on that file, never a marquee.
            refusePress: (e) => e.button !== 0 || (e.target as Element).closest('[data-name]') !== null,
            threshold: 4,
            onMarquee,
          }}
        />
      </div>

      {autoFit.measuring !== null && (
        <TableRuler
          ref={autoFit.rulerRef}
          column={autoFit.measuring}
          rows={rows}
          cell={cellOf}
          cellClassName={cellClass}
        />
      )}
    </>
  );
}
