#!/usr/bin/env python3
"""check_map -- the mechanical and schema tiers for a repo's MAP (`grill-map` output).

    python3 check_map.py [--config PATH] [--selftest] [file ...]

A MAP is a link graph whose value is entirely in edges that resolve and claims that
stay true. Everything here is a check a machine can settle; the tier that needs
judgement -- the same fact stated in two notes -- is the skill's, not this file's.

**Nothing about a specific repo is written in this file.** Path roots, source globs,
section names and the note kinds all come from the config, because every
false-positive run this checker has ever had was a root-convention mismatch rather
than a defect. See `check_map.example.json`, beside this file.

## What it checks, and why each one is silent without it

1. **Links and `#anchors` resolve.** A missing file 404s and is loud; a missing
   anchor **silently** lands on the top of the target document, so a link that used
   to point at one row starts pointing at a whole file and the reader never learns
   they were misrouted. Anchors are the volatile half -- headings carrying issue
   numbers and verification dates get rewritten by routine maintenance, breaking
   links in files nobody touched.
2. **Every path and symbol under `## Code` exists, and the symbol lives in the file
   its own bullet names.** Checking only that a name exists *somewhere* leaves half
   the bullet's claim ungated, and that half is where the defects are: justerm's map
   named `GridId::DEFAULT` for six days after the constant was deleted, and passed
   every gate it had, because the tokenizer never extracted the name at all. A
   bullet naming no path keeps the tree-wide check -- it claims no location.
3. **The section set is complete, per note kind.** Empty sections are load-bearing:
   `**None.**` under `## Governing decisions` *is* the finding, so a note may not
   drop the heading to hide the hole.
4. **`**None.**` sits under a heading.** The sentinel marks several different holes,
   so it is meaningless without the heading that says which.
5. **Reciprocity, both directions.** Every territory an invariant claims must claim
   it back, and vice versa. Not symmetry for its own sake: the reading protocol
   sends a reader to their territory's own list as a checklist, so an invariant the
   territory omits is invisible at exactly the moment it is needed. A vault's
   backlink panel is a different surface and is absent on GitHub.
6. **No note restates a value another artifact owns** -- a decision record's status,
   most often. The copy has no gate; the record's own line does.
7. **A repo `.md` path cited from a source *comment* still exists.** Comments are
   links too, and nothing else looks at them.

## The three traps this file is built around, each one paid for

- **Split on `\\r?\\n`, never `\\n`.** On a CRLF checkout a `\\n` split leaves `\\r` on
  every line; `.` does not match it and `$` does not match before it, so
  `^#{1,6}\\s+(.*)$` matches **zero** headings, every anchor set comes back empty and
  every correct link is reported broken. It did exactly that against 11 valid links.
- **Blank code spans and fences before extracting anything.** Documentation *about*
  links contains link-shaped text. Replace with spaces so offsets, and therefore
  line numbers, survive.
- **Resolve paths against configured roots.** A repo may address its crates without
  the `crates/` prefix, and a bullet may list bare filenames under a directory named
  earlier in the same bullet. Both look like a missing file to a checker that
  assumes the repo root, and the result is a 100% false-positive run indistinguishable
  from catastrophe.

A gate is not verified until it has been shown to **pass** on known-good input,
**fail** on each defect kind, and **ignore** what it should ignore. `--selftest` is
that, as a command rather than a memory.
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

# This repository's copy is the SOURCE, so its stamp is not meaningful here --
# nothing is upstream of it to be behind. A copy vendored into a consuming repo
# records the revision it was taken at, and a stamp that is behind means this
# file has moved since: warn, never self-update.
#
# It reads `unstamped` because nothing writes it. The `checkup` skill did, and
# it is retired (ADR-0033) -- the one part of it that ever ran is this script.
# Kept as a placeholder rather than deleted: the field is what a vendored copy
# fills in, and removing it would take the mechanism along with its writer. A
# stamp labels and does not warn (ADR-0051); what warns is a consumer comparing
# it against `git log` in the skills checkout.
#
# The config file stays `.checkup.json`. Renaming it would break every consuming
# repo that already has one on disk, and the name is not wrong -- only the skill
# it was named after is gone.
BUILD_STAMP = "check_map @ kihyun-skills 0a76ff1 (vendored 2026-09-29)"

DEFAULTS = {
    "map_dir": "docs/map",
    "path_roots": ["."],
    "source_globs": [],
    "comment_globs": [],
    "comment_exts": [".rs", ".ts", ".tsx", ".mjs", ".js", ".py"],
    "cited_path_pattern": r"`((?:docs|teach)/[A-Za-z0-9_./-]+\.md)`",
    "kinds": {},
    "aggregate": None,
    "owned_value_patterns": [],
    "skip_dirs": [".git", "node_modules", "target", "dist", "pkg", "build"],
}


# ------------------------------------------------------------------ config --


def load_config(root, explicit):
    path = explicit or os.path.join(root, ".checkup.json")
    if not os.path.exists(path):
        sys.exit(
            f"check_map: no config at {path}\n"
            "  This file hardcodes nothing about your repo -- it needs one.\n"
            "  Copy `check_map.example.json` from beside this file and edit it.\n"
            "  (The `checkup` skill used to write it and is retired -- ADR-0033.)"
        )
    with open(path, encoding="utf-8") as fh:
        cfg = dict(DEFAULTS, **json.load(fh))
    if not cfg["kinds"]:
        sys.exit(f"check_map: {path} declares no note kinds -- nothing to check against.")
    return cfg


# ----------------------------------------------------------------- helpers --


def blank_fences(text):
    """Fenced blocks -> spaces, offsets preserved. Inline spans left alone."""
    out = list(text)
    pos, in_fence = 0, False
    for line in text.split("\n"):
        stripped = line.lstrip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            for i in range(len(line)):
                out[pos + i] = " "
        elif in_fence:
            for i in range(len(line)):
                out[pos + i] = " "
        pos += len(line) + 1
    return "".join(out)


def blank_code(text):
    """Fences AND inline spans -> spaces, offsets preserved. Use before extracting
    links: documentation *about* links contains link-shaped text inside spans."""
    return re.sub(
        r"(`+)(?:[^\n]*?)\1", lambda m: " " * len(m.group(0)), blank_fences(text)
    )


def slug(heading):
    """GitHub's heading -> anchor rule."""
    s = heading.strip()
    s = re.sub(r"<[^>]*>", "", s)
    s = re.sub(r"\[\[([^\]|]*)(?:\|[^\]]*)?\]\]", r"\1", s)
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[`*_~]", "", s)
    s = s.lower()
    s = re.sub(r"[^a-z0-9 _-]", "", s)
    # Each space becomes one hyphen -- runs are NOT collapsed. A heading like
    # `## Damage / dirty tracking` loses the slash and keeps both spaces around it,
    # so GitHub's anchor is `damage--dirty-tracking`. Collapsing the run reports every
    # such link as broken, and headings with an em-dash or a slash are the common case.
    return s.strip().replace(" ", "-")


_anchor_cache = {}


def anchors_of(path):
    """Every anchor a markdown file exposes, with GitHub's duplicate suffixes."""
    if path in _anchor_cache:
        return _anchor_cache[path]
    if not path.endswith(".md") or not os.path.exists(path):
        _anchor_cache[path] = None
        return None
    seen, out = {}, set()
    with open(path, encoding="utf-8", errors="replace") as fh:
        # Fences only. An inline code span inside a HEADING keeps its text in the
        # anchor -- `## ... answers with `null` (#688)` slugs to `...-with-null-688`.
        # Blanking spans here turns that text into spaces and every such link, which
        # is most of them once headings carry types and operators, reads as broken.
        body = blank_fences(fh.read())
    for line in body.split("\r\n" if "\r\n" in body else "\n"):
        m = re.match(r"^ {0,3}#{1,6}\s+(.*)$", line.rstrip("\r"))
        if not m:
            continue
        base = slug(m.group(1))
        if not base:
            continue
        n = seen.get(base, 0)
        seen[base] = n + 1
        out.add(base if n == 0 else f"{base}-{n}")
    _anchor_cache[path] = out
    return out


def section(text, heading):
    m = re.search(
        r"^" + re.escape(heading) + r"\s*$(.*?)(?=^## |\Z)", text, re.M | re.S
    )
    return m.group(1) if m else ""


def bullets(text):
    """Top-level `- ` items, continuation lines folded in."""
    out, buf = [], []
    for line in text.split("\n"):
        line = line.rstrip("\r")
        if re.match(r"^\s*-\s", line):
            if buf:
                out.append(" ".join(buf))
            buf = [line.strip()]
        elif buf and line.strip():
            buf.append(line.strip())
        elif buf:
            out.append(" ".join(buf))
            buf = []
    if buf:
        out.append(" ".join(buf))
    return out


def kind_of(cfg, path):
    rel = os.path.relpath(path, cfg["_root"]).replace(os.sep, "/")
    for name, spec in cfg["kinds"].items():
        if re.search(spec["match"], rel):
            return name
    return None


_source_text = None


def source_text(cfg):
    """Every configured source file, concatenated. The tree-wide haystack."""
    global _source_text
    if _source_text is None:
        chunks = []
        for pat in cfg["source_globs"]:
            for f in glob.glob(os.path.join(cfg["_root"], pat), recursive=True):
                if os.path.isfile(f):
                    with open(f, encoding="utf-8", errors="replace") as fh:
                        chunks.append(fh.read())
        _source_text = "\n".join(chunks)
    return _source_text


_index = None


def file_index(cfg):
    """basename -> paths, and the flat path list. Built once from `source_globs`.

    A `## Code` bullet is prose as well as a list, and prose names files the short way:
    `walk.rs` for `core/src/term/walk.rs`, `src/selection.rs` for the crate's copy of
    it. Resolving those against the repo root alone reports a correct note as broken.
    Resolution is by UNIQUENESS -- one candidate is the location, several claim
    nothing -- so this never guesses which of two same-named files was meant."""
    global _index
    if _index is None:
        by_name, all_paths = {}, []
        for pat in cfg["source_globs"]:
            for f in glob.glob(os.path.join(cfg["_root"], pat), recursive=True):
                if not os.path.isfile(f):
                    continue
                all_paths.append(f)
                by_name.setdefault(os.path.basename(f), []).append(f)
        _index = (by_name, all_paths)
    return _index


def resolve_loose(tok, cfg):
    """Last resort for a path token no configured root matched: a bare name, or a
    path suffix. Returns a path only when exactly one file in the tree fits."""
    by_name, all_paths = file_index(cfg)
    if "/" not in tok:
        hits = by_name.get(tok, [])
    else:
        suffix = os.sep + tok.replace("/", os.sep)
        hits = [p for p in all_paths if p.endswith(suffix)]
    return hits[0] if len(hits) == 1 else None


def scope_text(paths, cfg):
    """A bullet names a directory to mean the files under it; binaries beside them
    carry no symbol and are skipped rather than decoded."""
    chunks = []
    for p in paths:
        if os.path.isdir(p):
            for dirpath, dirnames, filenames in os.walk(p):
                dirnames[:] = [d for d in dirnames if d not in cfg["skip_dirs"]]
                for f in filenames:
                    if os.path.splitext(f)[1] in cfg["comment_exts"] or f.endswith(
                        (".toml", ".yml", ".yaml")
                    ):
                        with open(
                            os.path.join(dirpath, f), encoding="utf-8", errors="replace"
                        ) as fh:
                            chunks.append(fh.read())
        elif os.path.isfile(p):
            with open(p, encoding="utf-8", errors="replace") as fh:
                chunks.append(fh.read())
    return "\n".join(chunks)


def rel(cfg, path):
    return os.path.relpath(path, cfg["_root"]).replace(os.sep, "/")


# ------------------------------------------------------------------ checks --


def check_sections(raw, kind, cfg, errs):
    spec = cfg["kinds"].get(kind) or {}
    for s in spec.get("sections", []):
        if not re.search(r"^" + re.escape(s) + r"\s*$", raw, re.M):
            errs.append(f"missing section: {s}")


def check_links(path, body, errs):
    for m in re.finditer(r"\[[^\]\n]*\]\(([^)\s]+)\)", body):
        target = m.group(1)
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        file_part, _, anchor = target.partition("#")
        dest = (
            os.path.normpath(os.path.join(os.path.dirname(path), file_part))
            if file_part
            else path
        )
        if file_part and not os.path.exists(dest):
            errs.append(f"broken link: {target}")
            continue
        if anchor:
            known = anchors_of(dest)
            if known is not None and slug(anchor) not in known:
                errs.append(
                    f"broken anchor: {target}  "
                    "(silent -- it lands on the top of the file)"
                )


def check_code(raw, cfg, errs):
    """A `## Code` bullet makes two claims -- these paths exist, and these symbols
    live in them. Both are checked, in that order, because the second needs the
    first: the bullet's own paths are the haystack its symbols are searched in."""
    roots_base = [os.path.join(cfg["_root"], r) for r in cfg["path_roots"]]
    for bullet in bullets(section(raw, "## Code")):
        dirs = re.findall(r"`([^`\n]*/)`", bullet)
        roots = roots_base + [os.path.join(r, d) for d in dirs for r in roots_base]
        scope, symbols = [], []
        # Grows as paths resolve. A bare filename may sit under a directory the same
        # bullet named earlier -- either as a directory (`rfx/`) or by naming another
        # file in it (`bitmap.rs` after `renderer/src/emoji.rs`). Handling only the
        # first form makes the second a 100%-false-positive generator.
        implied = []
        for tok in (t.strip() for t in re.findall(r"`([^`\n]+)`", bullet)):
            if tok.startswith("[") or any(c in tok for c in '"|$'):
                continue  # a spec citation or a shell fragment, not a name
            if tok.split(" ")[0] in cfg.get("command_words", []):
                continue  # a derivation command, not a name
            if "/" in tok or os.path.splitext(tok)[1] in cfg["comment_exts"] or tok.endswith(
                (".toml", ".yml", ".yaml")
            ):
                p = tok.rstrip("/")
                if "*" in p or "?" in p:
                    # A glob claims "the files matching this", so it is satisfied by any
                    # match. `demo/*.ts` is a real claim; treating it as a literal path
                    # reports a file nobody named as missing.
                    hits = [
                        m
                        for r in roots + implied
                        for m in glob.glob(os.path.join(r, p))
                    ] or glob.glob(
                        os.path.join(cfg["_root"], "**", p), recursive=True
                    )
                    if not hits:
                        errs.append(f"glob under ## Code matches nothing: {tok}")
                    scope.extend(hits)
                    continue
                hit = next(
                    (
                        os.path.join(r, p)
                        for r in roots + implied
                        if os.path.exists(os.path.join(r, p))
                    ),
                    None,
                )
                if hit is None:
                    hit = resolve_loose(p, cfg)
                if hit is None:
                    # A bare name that resolves nowhere is prose, not a path claim --
                    # "a set which does not include `tests/`". Only a spelled-out path
                    # is held to, and that one is genuinely missing.
                    if "/" not in p:
                        continue
                    errs.append(f"path under ## Code does not exist: {tok}")
                else:
                    scope.append(hit)
                    d = hit if os.path.isdir(hit) else os.path.dirname(hit)
                    if d not in implied:
                        implied.append(d)
                continue
            # A token is a symbol only if the WHOLE token is an identifier, optionally
            # `::`-qualified. Taking the prefix up to the first non-identifier
            # character instead turns `wasm-pack` into `wasm` and `Term::report_*`
            # into `report_`, and reports both as missing against a correct map.
            if not re.fullmatch(
                r"[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*", tok
            ):
                continue
            symbols.append((tok, tok.split("::")[-1]))

        # A bullet naming no path claims no location -- there the tree-wide search is
        # the honest check rather than a weakened one.
        haystack = scope_text(scope, cfg) if scope else source_text(cfg)
        where = ", ".join(rel(cfg, p) for p in scope) if scope else "tree"
        for tok, name in symbols:
            if not re.search(r"\b" + re.escape(name) + r"\b", haystack):
                errs.append(f"symbol not found in {where}: {name}  (from `{tok}`)")


def check_sentinel(raw, errs):
    for m in re.finditer(r"^\*\*None\.\*\*", raw, re.M):
        if not re.findall(r"^## .*$", raw[: m.start()], re.M):
            errs.append("sentinel **None.** appears before any section heading")


def check_owned_values(body, cfg, errs):
    """Nothing here may restate a value another artifact owns. The pull is strongest
    exactly where the value is load-bearing, which is why this is a gate and not a
    convention."""
    for spec in cfg["owned_value_patterns"]:
        for m in re.finditer(spec["pattern"], body, re.I):
            errs.append(
                f"restates a value {spec['owner']} owns: "
                f"\"{m.group(0).strip()[:70]}\" -- {spec['say_instead']}"
            )


def check_reciprocity(cfg):
    """Every note `from` claims must claim it back.

    **One direction is load-bearing and the other is a repo's choice.** The forward
    rule is justified by the reading protocol: a reader lands on their territory and
    reads its list as a checklist, so an invariant that list omits is invisible at
    exactly the moment it is needed. That argument does not symmetrise. An invariant's
    own section is a roster of *sites*, and a territory may legitimately name it as its
    origin, or as context, without being one -- one map says so in as many words: *"this
    territory is the source of that constraint rather than a site of it"*. Another keeps
    its roster deliberately incomplete, deriving the mechanical half from a grep and
    hand-writing only what no grep can see.

    So `both_ways` is opt-in. Turned on against a map that scopes its rosters, it
    reports the design as a defect -- four times, on its first run."""
    pairs = cfg.get("reciprocity")
    if not pairs:
        return []
    errs = []
    a, b = pairs["from"], pairs["to"]
    both_ways = pairs.get("both_ways", False)
    claims, listed = {}, {}
    for p in sorted(glob.glob(os.path.join(cfg["_map"], a["dir"], "*.md"))):
        body = section(open(p, encoding="utf-8").read(), a["section"])
        claims[os.path.basename(p)] = set(re.findall(a["link_pattern"], body))
    for p in sorted(glob.glob(os.path.join(cfg["_map"], b["dir"], "*.md"))):
        body = section(open(p, encoding="utf-8").read(), b["section"])
        listed[os.path.basename(p)] = set(re.findall(b["link_pattern"], body))
    for src, targets in claims.items():
        for t in targets:
            if t not in listed:
                errs.append(f"{a['dir']}/{src} claims a note that does not exist: {t}")
            elif src not in listed[t]:
                errs.append(
                    f"one-way edge: {a['dir']}/{src} claims {t}, "
                    f"which does not list it back"
                )
    for src, targets in listed.items():
        for t in targets:
            if t not in claims:
                errs.append(f"{b['dir']}/{src} lists a note that does not exist: {t}")
            elif both_ways and src not in claims[t]:
                errs.append(
                    f"one-way edge: {b['dir']}/{src} lists {t}, "
                    f"which does not claim it"
                )
    return errs


def check_comment_citations(cfg):
    """A repo path cited from a code comment is a link too, and until this ran,
    nothing looked at it. A renamed target leaves the comment pointing at nothing,
    silently."""
    if not cfg["comment_globs"]:
        return [], 0
    errs, checked = [], 0
    pat = re.compile(cfg["cited_path_pattern"])
    is_comment = re.compile(r"^\s*(//|/\*|\*|#)")
    roots = [os.path.join(cfg["_root"], r) for r in cfg["path_roots"]]
    for g in cfg["comment_globs"]:
        for f in glob.glob(os.path.join(cfg["_root"], g), recursive=True):
            if not os.path.isfile(f):
                continue
            if os.path.splitext(f)[1] not in cfg["comment_exts"]:
                continue
            if any(f"{os.sep}{d}{os.sep}" in f for d in cfg["skip_dirs"]):
                continue
            with open(f, encoding="utf-8", errors="replace") as fh:
                for i, line in enumerate(fh.read().split("\n"), 1):
                    if not is_comment.match(line):
                        continue
                    for m in pat.finditer(line):
                        checked += 1
                        cited = m.group(1)
                        if not any(
                            os.path.exists(os.path.join(r, cited)) for r in roots
                        ):
                            errs.append(
                                f"{rel(cfg, f)}:{i}: comment cites a file that does "
                                f"not exist -> {cited}"
                            )
    return errs, checked


# -------------------------------------------------------------------- main --


def check_file(path, cfg):
    errs = []
    with open(path, encoding="utf-8") as fh:
        raw = fh.read()
    kind = kind_of(cfg, path)
    agg = cfg.get("aggregate")
    if agg and raw.startswith(agg["marker"]):
        if agg["must_contain"] not in raw:
            errs.append(f"aggregate note does not say: {agg['must_contain']}")
    elif kind:
        check_sections(raw, kind, cfg, errs)
    body = blank_code(raw)
    check_links(path, body, errs)
    if kind and "## Code" in raw:
        check_code(raw, cfg, errs)
    check_sentinel(raw, errs)
    check_owned_values(body, cfg, errs)
    return errs


def run(root, cfg_path, targets):
    root = os.path.abspath(root)
    cfg = load_config(root, cfg_path)
    cfg["_root"] = root
    cfg["_map"] = os.path.join(root, cfg["map_dir"])
    if not os.path.isdir(cfg["_map"]):
        sys.exit(f"check_map: no map at {cfg['_map']}")

    # The scope is derived here rather than intended, because a gate whose scope has
    # drifted from the tree passes having inspected nothing -- the one failure mode
    # indistinguishable from a clean run.
    files = targets or sorted(
        glob.glob(os.path.join(cfg["_map"], "**", "*.md"), recursive=True)
    )
    failing = 0
    for f in files:
        errs = check_file(f, cfg)
        print(("ok   " if not errs else "FAIL ") + rel(cfg, f))
        for e in errs:
            print("       " + e)
        failing += 1 if errs else 0

    if not targets:
        rec = check_reciprocity(cfg)
        print(("ok   " if not rec else "FAIL ") + "reciprocity")
        for e in rec:
            print("       " + e)
        failing += 1 if rec else 0

        cites, n = check_comment_citations(cfg)
        if cfg["comment_globs"]:
            # A scan that inspected nothing is not a pass. `comment_globs` that match
            # no file, or a `skip_dirs` entry that happens to name a real source
            # directory, both produce a silent zero -- indistinguishable from clean.
            if n == 0:
                cites = cites + [
                    "comment_globs matched no citation at all -- check the globs "
                    "and skip_dirs; a scan that inspected nothing is not a pass"
                ]
            print(("ok   " if not cites else "FAIL ") + f"comment citations ({n})")
            for e in cites:
                print("       " + e)
            failing += 1 if cites else 0

    print(f"\n{BUILD_STAMP}")
    print(f"{len(files)} note(s) checked, {failing} failing")
    return 1 if failing else 0


# --------------------------------------------------------------- self-test --
#
# Runs this script as a subprocess against a throwaway mini-map in a temp directory
# rather than calling the check functions in-process: every root is derived from the
# config at load time, so `cwd=` is the whole fixture and there is nothing to
# monkeypatch. A gate is not verified until it has been shown to pass on known-good
# input, fail on each defect kind, and ignore what it should ignore.

FIXTURE_CONFIG = {
    "map_dir": "docs/map",
    "path_roots": [".", "crates"],
    "source_globs": ["crates/*/src/*.py"],
    "comment_globs": ["crates/*/src/*.py"],
    "comment_exts": [".py"],
    "cited_path_pattern": r"`(docs/[A-Za-z0-9_./-]+\.md)`",
    "command_words": ["grep", "ls"],
    "kinds": {
        "territory": {
            "match": r"territory/",
            "sections": ["## What it is", "## Code", "## Cross-cutting invariants"],
        },
        "invariant": {
            "match": r"invariant/",
            "sections": ["## The fact", "## Territories it holds in"],
        },
    },
    "aggregate": {"marker": "# Aggregate", "must_contain": "owns no detail"},
    "owned_value_patterns": [
        {
            "pattern": r"ADR-\d{4}[^.\n]{0,60}?\b(?:is|remains)\s+(?:proposed|accepted)\b",
            "owner": "the decision record",
            "say_instead": 'say "check its Status line"',
        }
    ],
    "reciprocity": {
        "from": {
            "dir": "invariant",
            "section": "## Territories it holds in",
            "link_pattern": r"\(\.\./territory/([a-z0-9-]+\.md)\)",
        },
        "to": {
            "dir": "territory",
            "section": "## Cross-cutting invariants",
            "link_pattern": r"\(\.\./invariant/([a-z0-9-]+\.md)\)",
        },
    },
}

FIX_TERRITORY = """# alpha

## What it is

The alpha area.

## Code

- `crates/alpha/src/thing.py` — `run_thing`, `Widget`
- the stage strings, which claim no location: `stage_name`

## Cross-cutting invariants

- [never panics](../invariant/never-panics.md)

## Notes

A link-shaped thing inside a code span must be ignored: `[x](../nope.md)`.
See [the fact](../invariant/never-panics.md#the-fact).
"""

FIX_INVARIANT = """# never panics

## The fact

It never panics.

## Territories it holds in

- [alpha](../territory/alpha.md)
"""

FIX_SOURCE = '''# The design is documented in `docs/map/territory/alpha.md`.


def run_thing():
    return Widget()


class Widget:
    pass


def stage_name():
    return "s"
'''


def write_fixture(base):
    os.makedirs(os.path.join(base, "docs/map/territory"))
    os.makedirs(os.path.join(base, "docs/map/invariant"))
    os.makedirs(os.path.join(base, "crates/alpha/src"))
    def put(p, s):
        with open(os.path.join(base, p), "w", encoding="utf-8") as fh:
            fh.write(s)
    put("docs/map/territory/alpha.md", FIX_TERRITORY)
    put("docs/map/invariant/never-panics.md", FIX_INVARIANT)
    put("crates/alpha/src/thing.py", FIX_SOURCE)
    put("crates/alpha/src/other.py", "def helper():\n    pass\n")
    put(".checkup.json", json.dumps(FIXTURE_CONFIG, indent=2))


T = "docs/map/territory/alpha.md"
I = "docs/map/invariant/never-panics.md"
S = "crates/alpha/src/thing.py"

# (name, file, old, new, expected substring, expected exit code)
# The baseline asserts the citation scan actually inspected something: a gate whose
# scope silently emptied reports a clean run, which is the one failure indistinguishable
# from success. It found this file's own fixture -- the crate was named `pkg`, which the
# default `skip_dirs` blanks as a wasm-pack output directory.
CASES = [
    ("baseline", None, None, None, "comment citations (1)", 0),
    ("broken link", T, "(../invariant/never-panics.md#the-fact)", "(../invariant/gone.md)", "broken link", 1),
    ("broken anchor", T, "#the-fact", "#no-such-heading", "broken anchor", 1),
    ("missing section", T, "## Cross-cutting invariants", "## Something else", "missing section", 1),
    ("path under ## Code does not exist", T, "crates/alpha/src/thing.py", "crates/alpha/src/gone.py", "does not exist", 1),
    ("symbol at a path it does not live in", T, "`run_thing`, `Widget`", "`run_thing`, `Elsewhere`", "symbol not found in", 1),
    ("symbol nowhere in the tree", T, "`stage_name`", "`no_such_stage_name`", "symbol not found in tree", 1),
    ("one-way invariant edge", T, "- [never panics](../invariant/never-panics.md)", "**None.**", "one-way edge", 1),
    ("sentinel before any heading", T, "# alpha", "**None.**\n\n# alpha", "sentinel", 1),
    ("restates an owned value", T, "The alpha area.", "ADR-0007 is accepted, so this holds.", "restates a value", 1),
    ("comment cites a file that does not exist", S, "docs/map/territory/alpha.md", "docs/map/territory/gone.md", "does not exist", 1),
    # Ignore-cases. A gate is only verified once it has also been shown NOT to fire on
    # what it should let through -- both of these produced false positives before.
    ("ignores a non-identifier token", T, "`stage_name`", "`stage_name`, `wasm-pack`", None, 0),
    ("bare filename beside a named file", T, "`run_thing`, `Widget`", "`run_thing`, `Widget` · `other.py` — `helper`", None, 0),
    ("ignores a link inside a code span", T, "`[x](../nope.md)`", "`[y](../also-nope.md)`", None, 0),
    # The reverse direction is opt-in. A roster that scopes itself -- to call sites, or
    # to what no grep can see -- is a design, and reporting it as a one-way edge turns
    # four correct notes into findings.
    ("reverse-direction edge is not a default failure", I, "- [alpha](../territory/alpha.md)", "**None.**", None, 0),
]


def selftest():
    script = os.path.abspath(__file__)
    failing = 0
    for name, target, old, new, expect, rc in CASES:
        with tempfile.TemporaryDirectory() as base:
            write_fixture(base)
            if target:
                p = os.path.join(base, target)
                with open(p, encoding="utf-8") as fh:
                    body = fh.read()
                assert old in body, f"{name}: fixture does not contain {old!r}"
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(body.replace(old, new, 1))
            proc = subprocess.run(
                [sys.executable, script],
                cwd=base,
                capture_output=True,
                text=True,
            )
            out = proc.stdout + proc.stderr
            good = proc.returncode == rc and (expect is None or expect in out)
            if rc == 0:
                good = good and "FAIL" not in out
            print(("ok   " if good else "FAIL ") + name)
            if not good:
                failing += 1
                print(f"       expected exit {rc} and: " + (expect or "a clean run"))
                for line in out.strip().split("\n")[:8]:
                    print("       | " + line)
    print(f"\nself-test: {len(CASES) - 1} defect kind(s) + baseline, {failing} failing")
    return 1 if failing else 0


def main():
    ap = argparse.ArgumentParser(add_help=True, description=__doc__)
    ap.add_argument("--config", help="path to .checkup.json (default: <root>/.checkup.json)")
    ap.add_argument("--root", default=".", help="repository root (default: cwd)")
    ap.add_argument("--selftest", action="store_true", help="verify this gate itself")
    ap.add_argument("files", nargs="*", help="check only these notes")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    return run(args.root, args.config, [os.path.abspath(f) for f in args.files])


if __name__ == "__main__":
    sys.exit(main())
