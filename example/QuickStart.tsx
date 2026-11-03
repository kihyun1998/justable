import {
  TableGrid,
  TableHeader,
  TableRow,
  createTableModel,
  useTableKeyboard,
  type ColumnLayout,
  type ColumnSpec,
  type TableMovement,
  type TableSort,
} from '@kihyun1998/justable';
import '@kihyun1998/justable/style.css';
import { useMemo, useState } from 'react';

interface Person {
  name: string;
  age: number;
}

type Key = 'name' | 'age';

const COLUMNS: ColumnSpec<Person, Key>[] = [
  {
    key: 'name',
    defaultWidth: 200,
    minWidth: 80,
    maxWidth: 480,
    hideable: false,
    movable: false,
    firstSortDesc: false,
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  {
    key: 'age',
    defaultWidth: 80,
    minWidth: 60,
    maxWidth: 160,
    hideable: true,
    movable: true,
    firstSortDesc: true,
    compare: (a, b) => a.age - b.age,
  },
];

const LABELS: Record<Key, string> = { name: 'Name', age: 'Age' };

const model = createTableModel(COLUMNS);

/** Which key moves the row where: the bindings are yours. */
const MOVES: Partial<Record<string, TableMovement>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Home: 'first',
  End: 'last',
  PageUp: 'pageUp',
  PageDown: 'pageDown',
};

export function People({ people }: { people: readonly Person[] }) {
  const [layout, setLayout] = useState<ColumnLayout<Key>>({ widths: {}, hidden: [] });
  const [sort, setSort] = useState<TableSort<Key>>();
  const [focused, setFocused] = useState<string | null>(null);
  const keyboard = useTableKeyboard({ windowMs: 700 });

  const rows = useMemo(() => model.sortRows(people, sort), [people, sort]);
  const index = rows.findIndex((p) => p.name === focused);
  const focus = index === -1 ? null : index;
  const columns = model.visibleColumns(layout);
  const gridStyle = { gridTemplateColumns: model.gridTemplate(layout) };

  return (
    <div style={{ height: 400, display: 'flex', flexDirection: 'column' }}>
      <TableGrid
        label="People"
        header={
          <TableHeader
            columns={columns.map((key) => ({
              key,
              label: LABELS[key],
              width: model.columnWidth(layout, key),
            }))}
            sort={sort}
            gridStyle={gridStyle}
            onSort={(key) => setSort((s) => model.nextSort(s, key))}
            onResize={(key, px) => setLayout((l) => model.withWidth(l, key, px))}
            resizeLabel="Resize column"
            refusePress={(e) => e.button !== 0}
          />
        }
        colCount={columns.length}
        total={rows.length}
        rowKey={(i) => rows[i]!.name}
        renderRow={(i, place) => (
          <TableRow
            id={place.id}
            rowIndex={place.rowIndex}
            style={place.style}
            columns={columns}
            gridStyle={gridStyle}
            className={place.focused ? 'row-focused' : undefined}
            onClick={() => {
              keyboard.end();
              setFocused(rows[i]!.name);
            }}
            cell={(key) => (key === 'name' ? rows[i]!.name : rows[i]!.age)}
          />
        )}
        fill
        focus={focus}
        rowIdPrefix="people"
        rowHeightRem={2}
        keyboard={keyboard.link}
        onKeyDown={(e) => {
          const movement = e.altKey ? undefined : MOVES[e.key];
          if (movement) {
            const to = keyboard.move(movement, { focus, total: rows.length });
            if (to === null) return;
            e.preventDefault();
            setFocused(rows[to]!.name);
            return;
          }
          const answer = keyboard.typeAhead(e, { focus, names: rows.map((p) => p.name) });
          if (answer?.to != null) setFocused(rows[answer.to]!.name);
        }}
      />
    </div>
  );
}
