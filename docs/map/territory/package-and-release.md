# Package and release

## What it is

How the engine leaves this repository: the `@kihyun1998/justable` npm package — ESM with type declarations and
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
- **The consumer consumes the published package.** PenTerm depends on `@kihyun1998/justable` from
  npm at an exact version (pinned at 0.1.2 in `penterm 1a8954d1b`, 2026-09-29), so an engine change
  reaches it only after a release here and a version bump there; its note keeps the install
  mechanics ([provenance](../MAP.md#penterm-provenance)).
- **Whether the package is on the registry** is `npm view @kihyun1998/justable version`; not a fact
  to store here.
- **The release process** — four calls, the maintainer's, 2026-09-29 (#7):
  - **0.x semver**, over 1.0 now: until 1.0 a breaking change to the exports, or to how one behaves,
    bumps the minor; anything else the patch.
  - **`CHANGELOG.md` written by hand**, over changesets — at release time as decided then;
    **superseded on when**, below.
  - **CI publishes on a `v*` tag**, over no publishing yet and over a person running `npm publish`.
  - **PenTerm stays on `file:`** while both are developed together, over installing the published
    version; moving it is a later call. That later call was made in PenTerm (`penterm 1a8954d1b`,
    2026-09-29): it installs the published version, pinned exactly.
  The steps are README § Releasing.
- **A change writes its CHANGELOG entry under `## Unreleased` in the change itself**, and the
  release turns that section into the version — the maintainer's call, 2026-09-30, over writing
  every entry at release time (#7, #14). Shown: the two records disagreed — this note and auto-fit's
  said "at release time, not ahead of it", README § Releasing already said "turn the unreleased
  entry into that version" — and #10 and #16 had already written `## Unreleased` entries on `main`.
  Still by hand. Theirs to reverse.
- **The publish job runs only after every gate passes** (`needs: gates` in `ci.yml`), and first
  checks that the tag names `package.json`'s version (`.github/scripts/check-tag.mjs`: `v0.1.0`
  passes, `v0.1.1`, `0.1.0` and no tag fail). It authenticates with the `NPM_TOKEN` repository
  secret, the maintainer's choice over npm trusted publishing, and checks it with `npm whoami` before
  publishing. `--provenance` attaches a build attestation, which needs the job's `id-token: write`.
  It has published every release, each from its `v*` tag's run — 0.1.0 through 0.3.3, eight by
  2026-10-06 (`gh run list`; the registry's `time`); 0.1.0 took a second run after the first was
  refused the name, and 0.3.1 a second attempt after the token was (both below). Before the first,
  a dry run on throwaway tags (2026-09-29, deleted after) saw a tag not naming the version fail at
  the tag check with every later step skipped, and a matching one pass `npm whoami` and pack the
  package; it asked the registry nothing about permission, which the first real publish then did
  (the name, below).
- **A version shows on the registry about a minute after npm accepts it.** For 0.3.1, npm printed
  `+ @kihyun1998/justable@0.3.1` at 02:15:14Z; `npm view @kihyun1998/justable@0.3.1` answered 404 at
  02:15:33Z; the registry records the version at 02:16:09Z (2026-10-06). So a check right after the
  job polls rather than concluding from the first answer.
- **The published tarball** is 36 files: `dist/`, `README.md`, `LICENSE` and `package.json`
  (`npm pack --dry-run`, 2026-09-29); 40 files at 0.2.0, the same day; 46 at 0.3.0 (2026-10-01), the `.js`
  and `.d.ts` of `useDrag`, `useHeaderLane` and `useRowWindow`; 46 at 0.3.1 (2026-10-06, counted with `pnpm pack`, no
  file added or removed); 46 at 0.3.2 and at 0.3.3 (2026-10-06, `npm pack --dry-run`). CI builds `dist/` fresh, so no file a local build left behind
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

- **`NPM_TOKEN` can lapse between releases, and nothing shows it until a tag runs.** Set
  2026-09-29, it published 0.3.0 on 2026-10-01 and was refused on 2026-10-06: `npm whoami` answered
  E401, the publish step was skipped, and the registry took nothing. Whether it expired or was
  revoked was not seen. A new token in the secret and the failed job re-run on the same tag
  (`gh run rerun <run> --failed`) published 0.3.1; no new version was needed, since npm had taken
  none.
- **The name is scoped, `@kihyun1998/justable`** — the maintainer's call, 2026-09-29, over another
  unscoped name. The first real publish, of `v0.1.0` as `justable`, was refused: npm answered 403,
  "Package name too similar to existing package stable", and suggested the scoped name. Nothing was
  published. The stylesheet's `justable:` class prefix and PenTerm's dependency key are not the
  package name and did not change.
- **A prerelease version cannot be published as the job stands**: npm refuses one without `--tag`
  ("You must specify a tag using --tag when publishing a prerelease version"), met by the dry run's
  first test version.
- **Nothing checks that `CHANGELOG.md` covers a release's changes**; it is written by hand.
- **TypeScript is pinned to `~7.0.2`**, the Go-native compiler; which declaration output a consumer on
  TypeScript 5 can read has not been checked.
