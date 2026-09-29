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
- **The release process** — four calls, the maintainer's, 2026-09-29 (#7):
  - **0.x semver**, over 1.0 now: until 1.0 a breaking change to the exports, or to how one behaves,
    bumps the minor; anything else the patch.
  - **`CHANGELOG.md` written by hand** at release time, over changesets.
  - **CI publishes on a `v*` tag**, over no publishing yet and over a person running `npm publish`.
  - **PenTerm stays on `file:`** while both are developed together, over installing the published
    version; moving it is a later call.
  The steps are README § Releasing.
- **The publish job runs only after every gate passes** (`needs: gates` in `ci.yml`), and first
  checks that the tag names `package.json`'s version (`.github/scripts/check-tag.mjs`: `v0.1.0`
  passes, `v0.1.1`, `0.1.0` and no tag fail). It authenticates with the `NPM_TOKEN` repository
  secret, the maintainer's choice over npm trusted publishing, and checks it with `npm whoami` before
  publishing. `--provenance` attaches a build attestation, which needs the job's `id-token: write`.
- **The published tarball** is 36 files: `dist/`, `README.md`, `LICENSE` and `package.json`
  (`npm pack --dry-run`, 2026-09-29). CI builds `dist/` fresh, so no file a local build left behind
  can ship.

## Code

- `package.json`
- `tsconfig.build.json`
- `tsconfig.json`
- `src/index.ts`
- `README.md`
- `CHANGELOG.md`
- `.github/workflows/ci.yml`
- `.github/scripts/check-tag.mjs`

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

- **The publish job has run only as a dry run**, 2026-09-29, on throwaway tags deleted after: a tag
  not naming the version failed at the tag check with every later step skipped, and a matching one
  passed `npm whoami` with `NPM_TOKEN` and packed `justable` (36 files) for public access. A dry run
  asks the registry nothing about permission, so whether the token may create `justable` — a package
  that does not exist yet — is still unknown until the first real tag. A token scoped to one package
  may not be able to create it.
- **A prerelease version cannot be published as the job stands**: npm refuses one without `--tag`
  ("You must specify a tag using --tag when publishing a prerelease version"), met by the dry run's
  first test version.
- **Nothing checks that `CHANGELOG.md` covers a release's changes**; it is written by hand.
- **TypeScript is pinned to `~7.0.2`**, the Go-native compiler; which declaration output a consumer on
  TypeScript 5 can read has not been checked.
