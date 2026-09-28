# Package and release

## What it is

How the engine leaves this repository: the `justable` npm package — ESM with type declarations and
one stylesheet, under two export paths — its peer dependencies, the build that produces `dist/`, and
the published README that is its user-facing contract. Also how its one consumer, PenTerm, reaches it
today.

## Governing decisions

**None.**

## Design model

- **Two export paths, nothing else reachable.** `.` → `dist/index.js` with `dist/index.d.ts`, and
  `./style.css` → `dist/style.css`. `files` ships `dist` only. `sideEffects` names `*.css`, so a
  bundler keeps the stylesheet import that tree-shaking would otherwise drop.
- **`src/index.ts` is the public surface**, and the one list of it. `README.md` § Exports names
  every export and must be changed with it — nothing checks the two agree.
- **The surface is what a consumer needs** — the maintainer's call, 2026-09-28, #5. Removed then,
  with no registry release yet and PenTerm the one consumer: `nextFocusIndex`, `classNames` (used by
  no consumer), and the type-ahead pieces once `useTypeAhead` replaced PenTerm's copy of them. The
  windowing functions stay public: PenTerm's folder tree windows with them.
- **React, React DOM and `lucide-react` are peers**, so the consumer's single copy is used — one
  React, not two.
- **The build is two steps**: `tsc -p tsconfig.build.json` emits JS and declarations from `src/`,
  excluding tests and `src/lint`; then the Tailwind CLI builds `src/style.css` into `dist/style.css`.
  Neither step runs the tests. `dist/` is ignored by git.
- **The consumer consumes `dist/`.** PenTerm depends on `file:../justable`, so an engine change
  reaches it only after `pnpm build` here and an install there; its note keeps the install mechanics
  ([provenance](../MAP.md#penterm-provenance)).
- **Whether the package is on the registry** is `npm view justable version`; not a fact to store here.

## Code

- `package.json`
- `tsconfig.build.json`
- `tsconfig.json`
- `src/index.ts`
- `README.md`

## Reference behaviour

**None.**

## Cross-cutting invariants

**None.**

## Blast radius

- [Stylesheet and prefix](stylesheet-and-prefix.md) — the second build step, and the Tailwind pin
  that the `--tw-*` registration depends on.
- [Colour variables](colour-variables.md) — `README.md` § Colours is the published variable roster.
- [Verification gates](verification-gates.md) — the build is not one of them; what is excluded from
  `dist/` must still be run by `pnpm test`.
- Every territory with a public export — a signature change in `src/index.ts`'s reach is a breaking
  change to a published package.

## Known holes / open

- **No release process is written down** — versioning, changelog, who publishes. The version is
  `0.1.0` and nothing records what would move it. Tracked: #7.
- **TypeScript is pinned to `~7.0.2`**, the Go-native compiler; which declaration output a consumer on
  TypeScript 5 can read has not been checked.
