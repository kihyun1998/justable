# Colour variables

## What it is

How the table gets its colours: it paints only through `--table-*` CSS custom properties, one per
role, with no fallback, and the consumer binds them on the element carrying `data-table` — the grid
root. The published roster of roles is `README.md` § Colours.

## Governing decisions

**None.**

## Design model

Read from the code, led by PenTerm's note ([provenance](../MAP.md#penterm-provenance)).

- **One variable per role, read through Tailwind's `(--var)` shorthand, never a named colour.** The
  engine names no consumer token, so it works in any app and reaches into no theme. Derive the roster
  in code rather than copying it:

  ```sh
  rg -o '\(--table-[a-z-]+\)' src --no-filename | sort -u
  ```

- **No fallbacks.** An unbound variable paints nothing, which is visible, rather than a guessed colour,
  which is not.
- **Bound on the table, never at `:root`.** A custom property holding `var(--x)` computes where it is
  declared and descendants inherit the result, so a scope that redefines `--x` below `:root` does not
  reach the table. Bound at `:root`, 8 of the 10 header colours came out wrong in each of two such
  scopes (PenTerm). The grid root carries `data-table` for exactly this.
- **Only the header and the marquee paint.** `TableHeader` uses every variable but the marquee's
  two; `TableGrid` paints only the marquee rectangle (`--table-marquee-fill`,
  `--table-marquee-border`); the rows and the ruler paint no colour. Row hover, selection and focus
  colours are the consumer's row classes.
- **Enforced by lint**, not by review: any colour-bearing utility whose value is not a `(--table-…)`
  variable fails [verification gates](verification-gates.md)' colour rule.

## Code

- `src/components/TableGrid.tsx` — `TableGrid`
- `src/components/TableHeader.tsx` — `TableHeader`, `HOVER_LAYER`
- `src/lint/the-engine-reaches-nothing-outside-itself.test.ts` — `colourViolations`, `COLOUR_ROOTS`, `NOT_A_COLOUR`

## Reference behaviour

**None.**

## Cross-cutting invariants

- [Mechanism here, policy in the consumer](../invariant/mechanism-here-policy-in-the-consumer.md) —
  which colour each role is, and every row colour, are the consumer's.

## Blast radius

- [Header row](header-row.md) — paints every role but the marquee's.
- [Marquee](marquee.md) — the rectangle's two roles.
- [Grid scaffold](grid-scaffold.md) — owns the `data-table` attribute the binding hangs on.
- [Package and release](package-and-release.md) — `README.md` § Colours is the published roster; a
  new, renamed or removed variable is a change to it, and to every consumer's binding.
- [Verification gates](verification-gates.md) — the lint's idea of a colour utility.

## Known holes / open

- **A `TableHeader` rendered outside a `TableGrid` has no `data-table` ancestor**, so a binding on
  `[data-table]` does not reach it; the consumer must bind on its own ancestor.
- **The roster lives in two places** — the README table and the code — and nothing checks that they
  agree.
