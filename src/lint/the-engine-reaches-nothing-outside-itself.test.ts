/**
 * The table engine reaches nothing outside itself: no import but its own files, React, React DOM
 * and the icon set, and no colour utility but one reading a `--table-*` variable.
 *
 * Written against the engine's own directory (found from this file, not from a repo root), so it
 * travels with the engine into its package unchanged. The colour rule names no consumer's tokens:
 * any colour-bearing utility whose value is a named token rather than a `(--table-…)` variable is a
 * reach into somebody's theme — invisible in the app that happens to define it, broken everywhere
 * else.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Engine source files: everything but tests and this directory. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'lint' ? [] : sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

const EXTERNAL = new Set(['react', 'react-dom', 'react/jsx-runtime', 'lucide-react']);

/** The engine's own alias, while it still lives in PenTerm's tree. */
const OWN_ALIAS = '@/frameworks/table/';

function importViolations(source: string): string[] {
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1]!,
  );
  return specifiers.filter(
    (s) => !(s.startsWith('.') || s.startsWith(OWN_ALIAS) || EXTERNAL.has(s)),
  );
}

/** Colour-bearing utility roots, longest first so `border-t` is read before `border`. */
const COLOUR_ROOTS = [
  'border-x', 'border-y', 'border-t', 'border-r', 'border-b', 'border-l', 'border',
  'bg', 'text', 'ring-offset', 'ring', 'outline', 'fill', 'stroke', 'divide', 'shadow', 'accent',
  'caret', 'decoration', 'placeholder', 'from', 'via', 'to',
];

/** Values that are not colours for some root: sizes, alignments, styles, keywords. */
const NOT_A_COLOUR =
  /^(?:\d.*|px|none|inherit|current|transparent|solid|dashed|dotted|double|hidden|left|center|right|justify|start|end|xs|sm|base|md|lg|xl|\dxl|wrap|nowrap|balance|pretty|ellipsis|clip|inset|offset.*|underline|overline|line-through|auto|clip-text|repeat.*|no-repeat|cover|contain|fixed|local|scroll|linear.*|radial.*|conic.*|origin.*|blend.*)$/;

function colourViolations(source: string): string[] {
  const out: string[] = [];
  // Every class-looking token inside a string literal.
  for (const literal of source.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
    for (const token of literal[2]!.split(/\s+/)) {
      // Strip variants (`hover:`, `justable:`, `after:`…) and a leading `-`.
      const utility = token.slice(token.lastIndexOf(':') + 1).replace(/^-/, '');
      if (utility === 'hover-ink') {
        out.push(token);
        continue;
      }
      // A root on its own (`border-b`, `ring`) is a width, not a colour.
      if (COLOUR_ROOTS.includes(utility)) continue;
      const root = COLOUR_ROOTS.find((r) => utility.startsWith(`${r}-`));
      if (!root) continue;
      const value = utility.slice(root.length + 1).replace(/\/.*$/, '');
      if (value.startsWith('(--table-')) continue;
      if (value.startsWith('(') || value.startsWith('[')) {
        out.push(token);
        continue;
      }
      if (NOT_A_COLOUR.test(value)) continue;
      out.push(token);
    }
  }
  return out;
}

describe('lint: the table engine reaches nothing outside itself', () => {
  const files = sourceFiles(ENGINE);

  it('finds the engine', () => {
    expect(files.length, `no engine sources under ${ENGINE}`).toBeGreaterThan(5);
  });

  it('imports only itself, React, React DOM and the icon set', () => {
    const found = files.flatMap((file) =>
      importViolations(fs.readFileSync(file, 'utf-8')).map(
        (s) => `${path.relative(ENGINE, file)}: ${s}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it('paints colour only through `--table-*` variables', () => {
    const found = files.flatMap((file) =>
      colourViolations(fs.readFileSync(file, 'utf-8')).map(
        (t) => `${path.relative(ENGINE, file)}: ${t}`,
      ),
    );
    expect(found).toEqual([]);
  });
});
