/** A made-up folder listing: enough rows to window, and names that exercise type-ahead. */
export interface FileEntry {
  name: string;
  kind: 'folder' | 'file';
  size: number;
  modified: Date;
}

/** Names with a space inside, sharing a prefix with others, and in both letter cases. */
const FIXED: readonly string[] = [
  'new folder',
  'news.txt',
  'New Year plan.md',
  'notes',
  'Cherry.png',
  'cherry.jpg',
  'citrus.csv',
];

const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'report', 'invoice', 'photo', 'backup', 'draft'];
const EXTS = ['.txt', '.md', '.png', '.csv', '.zip', ''];

/** Deterministic, so every reload shows the same list. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s / 2 ** 31;
  };
}

export function makeFiles(count: number): FileEntry[] {
  const random = seeded(7);
  const start = Date.UTC(2024, 0, 1);
  const out: FileEntry[] = FIXED.map((name, i) => ({
    name,
    kind: name.includes('.') ? 'file' : 'folder',
    size: name.includes('.') ? 1_000 * (i + 1) : 0,
    modified: new Date(start + i * 86_400_000),
  }));
  for (let i = out.length; i < count; i += 1) {
    const ext = EXTS[Math.floor(random() * EXTS.length)]!;
    const word = WORDS[Math.floor(random() * WORDS.length)]!;
    out.push({
      name: `${word}-${String(i).padStart(4, '0')}${ext}`,
      kind: ext === '' ? 'folder' : 'file',
      size: ext === '' ? 0 : Math.floor(random() * 50_000_000),
      modified: new Date(start + Math.floor(random() * 900) * 86_400_000),
    });
  }
  return out;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}
