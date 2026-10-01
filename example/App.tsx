import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

import { FolderList } from './FolderList.js';
import { FileTable } from './FileTable.js';
import { makeFiles } from './files.js';

const FILES = makeFiles(5_000);
/** `?leading=1` draws a `..` row above the files, as a file explorer does. */
const PARENT_ROW = new URLSearchParams(location.search).has('leading');

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState('Click a row, or focus the table and type a name.');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const folders = useMemo(() => FILES.filter((f) => f.kind === 'folder').map((f) => f.name), []);

  return (
    <div className="app">
      <header className="toolbar">
        <h1>justable</h1>
        <label>
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
          />
          dark
        </label>
        <label>
          <input type="checkbox" checked={disabled} onChange={(e) => setDisabled(e.target.checked)} />
          disabled
        </label>
      </header>

      <section className="pane sidebar">
        <div className="pane-title">Folders — useTypeAhead + windowing</div>
        <FolderList names={folders} onStatus={setStatus} />
      </section>

      <section className="pane">
        <FileTable files={FILES} disabled={disabled} parentRow={PARENT_ROW} onStatus={setStatus} />
      </section>

      <footer className="status">{status}</footer>
    </div>
  );
}

/** The modifier state a click or key carries, for the selection rules both panes share. */
export type Modifiers = Pick<MouseEvent | KeyboardEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>;
