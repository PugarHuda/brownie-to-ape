# Changelog

All notable changes to `brownie-to-ape` are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Pre-1.0 versions correspond to the development phases tracked in the
hackathon submission. After the registry publish, this becomes a normal
SemVer changelog.

## [0.7.6] — 2026-05-02

Yearn validation, accounts.impersonate, GitHub Pages live demo.

### Added
- **Pass 7b: `accounts.at(addr, force=True)` → `accounts.impersonate_account(addr)`**.
  Brownie's whale-impersonation idiom now auto-rewrites to Ape's
  dedicated API. Strict guard: `force=True` MUST be present (bare
  `accounts.at(addr)` is a different operation and is left alone).
- **5th OSS repo validation**:
  [yearn/brownie-strategy-mix](https://github.com/yearn/brownie-strategy-mix)
  — the official Yearn Finance strategy template used by all Yearn
  strategy developers. **4 / 7 .py files modified, ~33 patterns
  auto-migrated, 0 false positives.**
- **`docs/index.html`** — single-file HTML live demo with interactive
  before/after diff viewer (6 tabs), metrics, repo table, and CTA.
  Deployable via GitHub Pages from `/docs`.
- Fixture **62**: accounts-at-impersonate (positive: force=True
  rewrites; negative: bare accounts.at unchanged).

## [0.7.3] — 2026-04-29

Final QA pass before registry publish.

### Added
- **4 more negative edge-case tests** (52–55):
  - Multi-line import with inline comments (comments inside import are
    dropped on rewrite — documents acceptable data loss).
  - Multiple `from brownie import` lines in same file (each fires Pass 1
    independently; output is multiple `from ape import` lines).
  - `accounts.add(...)` inside lambda + list comprehension (parent
    kind is `lambda` / `for_in_clause`, not `expression_statement` /
    `assignment` — Pass 7's safe-context guard correctly skips).
  - File with "brownie" only in string literals / comments (no AST
    brownie nodes — early-exit text check passes but no transform fires;
    output equals input).
- **`tests/test_migrate_config.py`** — 13 unit tests for
  `scripts/migrate_config.py`'s `translate()` function.
- **`.gitattributes`** — normalize all text files to LF on commit.
  Eliminates the "LF will be replaced by CRLF" warnings on Windows.

## [0.7.2] — 2026-04-29

Coverage extension + edge-case hardening + adoption polish.

### Added
- **`ZERO_ADDRESS` move-to-utils rewrite**. Brownie's
  `from brownie import ZERO_ADDRESS` becomes
  `from ape.utils import ZERO_ADDRESS` instead of being dropped via
  the contract-name heuristic. New `IMPORT_NAMES_TO_APE_UTILS` set in
  the codemod for any future similar moves.
- **5 new edge-case tests** (47–51): ZERO_ADDRESS with other names,
  ZERO_ADDRESS only, walrus operator with `accounts.add`, async/await
  wrapping a tx-dict, try/except guarded import.
- **`scripts/preview.sh`** — wrapper around `codemod workflow run
  --dry-run` that parses the per-file stats JSON and prints an
  aggregated summary (total edits, Wei rewrites, brownie.attr renames,
  unknown exceptions). Lets users see what would change without
  modifying any files.
- **`LICENSE`** (MIT, was previously only declared in codemod.yaml),
  **`.editorconfig`**, **`SECURITY.md`**.
- **README FAQ section** — 7 common questions with concrete answers.
- **README Troubleshooting section** — 6 symptom→fix entries.

### Changed
- Pass 1 import-rewrite logic refactored to support **three
  destinations** per imported name: `from ape import …`,
  `from ape.utils import …`, or dropped (with TODO). Mixed imports
  produce two adjacent `from …` lines.

## [0.7.1] — 2026-04-29

QA hardening + ergonomics polish.

### Added
- **Test 45**: `convert` import deduplication. When the file already
  has `from ape.utils import convert`, Pass 9's auto-injection skips
  to avoid duplicate imports.
- **Test 46**: malformed Python file robustness. Tree-sitter is
  error-tolerant; the codemod still applies transforms to well-formed
  parts and doesn't crash on syntax errors.
- DEMO.md sections: `--dry-run` preview, per-file stats JSON example,
  visual demo (asciinema cast), reproducible benchmark, quick rollback.
- README rollback one-liner + demo cast playback section.
- Cleaned `package.json` with practical npm scripts (`test`,
  `validate`, `benchmark`, `demo`, `render-cast`, `publish:codemod`).

### Fixed
- Pass 9 (Wei → convert) checks for an existing
  `from ape.utils import convert` before adding it to `preludeAdditions`.
  Prevents duplicate imports in files that have been partially migrated
  by hand.

## [0.7.0] — 2026-04-29

Wei auto-rewrite, Web3.py adjacency, ergonomics polish.

### Added
- **Pass 9 graduated from inline-TODO to actual rewrite.** `Wei("X")` →
  `convert("X", int)` when the argument is a single string literal.
- **Auto-injection of `from ape.utils import convert`** at a non-import
  anchor when Pass 9 fires. Combined with the existing unknown-exception
  TODO into one prelude edit to avoid edit-overlap collisions.
- **Pass 12: Web3.toWei / Web3.fromWei inline TODO**. Brownie projects
  routinely use `Web3.toWei(0.1, "ether")` (web3.py); we surface the Ape
  migration path without auto-rewriting (the arg shapes are different).
- **Stats reporting**: `console.error` JSON line per file with edit
  counts, when supported by the runtime.
- **`scripts/render_cast.py`**: synthesize an asciinema v2 `.cast` file
  from a script representation of the demo (`demo/demo.cast`). Reviewers
  can play back the codemod without running it.
- `.github/PULL_REQUEST_TEMPLATE.md` and `.github/ISSUE_TEMPLATE/{bug,feature}.md`.
- Fixture 44 (`web3-towei-fromwei`).

### Changed
- Anchor-based prelude additions now target the **first token** of the
  first non-import node (e.g. the `def` keyword) instead of the whole
  node. Tiny edit range = no overlap with body edits like Wei rewrites
  inside the same function.

### Fixed
- `migrate_config.py` now wraps file IO and YAML parsing in try/except
  with helpful error messages (exit codes 3/4/5/6/7 distinguish
  permissions, syntax, schema, translator bugs, output write).
- Removed remaining em-dash characters from script stdout/stderr writes
  to avoid Windows cp1252 encode errors (file CONTENT keeps them; only
  console output is affected).

## [0.6.0] — 2026-04-29

Code-quality + adoption polish.

### Added
- **Method-call guard on Pass 4** (tx-dict). The codemod now requires the
  call's function field to be an `attribute` (e.g., `obj.method(...)` or
  `Class.deploy(...)`) before rewriting a tx-dict to kwargs. This
  eliminates a latent FP on `OrderedDict({"from": x})`, `dict({...})`,
  `defaultdict({...})`, `partial(f, {...})`, and module-level helper
  functions.
- 5 new fixture tests (39–43): OrderedDict negative, helper-function
  negative, mixed quotes, trailing comma, nested dict value. **43 tests
  total, 100% passing.**
- README TL;DR section, badges, and "manual vs codemod" comparison
  table.
- CHANGELOG.md (this file) and CONTRIBUTING.md.

## [0.5.0] — 2026-04-28

Performance + demo + benchmark.

### Added
- `scripts/benchmark.sh` — auto-clones the four reference Brownie repos,
  times the codemod, emits a markdown table to `benchmark/results.md`.
- `DEMO.md` — six curated before/after examples drawn from real-repo
  diffs, covering each transform pass.
- `demo/run-demo.sh` — self-contained demo (asciinema-friendly) that
  clones a public Brownie repo, runs the codemod, and prints a sample
  diff.
- `CASE_STUDY.md` §8.5 with embedded benchmark results.

## [0.4.0] — 2026-04-28

More transforms + 4th OSS repo validation.

### Added
- **Pass 9: `Wei("X")` inline TODO** — flags safe-context Wei calls with
  `# TODO: from ape.utils import convert; convert("X", int)`.
- **Pass 10: `interface.X(addr)` inline TODO** — flags Brownie's
  auto-loaded ABI pattern, suggests Ape's `Contract(addr)` with explicit
  ABI/type.
- **Pass 2c.unknown** — emits a top-of-file TODO listing
  `exceptions.X` references whose class names aren't in the
  `EXCEPTION_MAP`.
- 4th real-repo validation on
  [PatrickAlphaC/aave_brownie_py_freecode](https://github.com/PatrickAlphaC/aave_brownie_py_freecode)
  — Aave DeFi integration, exercises Pass 10 (5 interface calls) and
  multi-line subscript `network.show_active()` rewrites.

### Changed
- Inline-TODO passes (7, 9, 10) refactored to replace ONLY the closing
  `)` token instead of the full call text. This composes with sibling
  passes — e.g., `network.show_active()` inside an `interface.X(...)`
  call's argument list now gets rewritten correctly while the outer
  call still receives its TODO annotation.

### Fixed
- Edit-overlap regression in Pass 10 that clobbered Pass 2b's
  `network.show_active()` rewrite when both fired on the same call.

## [0.3.0] — 2026-04-28

Exception handling + isolate fixture detection + YAML config converter.

### Added
- **Pass 2c: `exceptions.X` rename** — maps `VirtualMachineError →
  ContractLogicError`, `RPCRequestError → RPCError`, `ContractNotFound →
  ContractNotFoundError`. Handles both bare (`exceptions.X` after
  `from brownie import exceptions`) and qualified
  (`brownie.exceptions.X`) forms.
- **Pass 7: `accounts.add()` inline TODO** — flags Brownie's
  `accounts.add(pk)` with the Ape equivalent
  `accounts.import_account_from_private_key(alias, passphrase, key)`.
  Safe-context guard (statement / assignment RHS only).
- **Pass 8: `def isolate(fn_isolation): pass` detection** — emits TODO
  noting Ape's built-in `chain.isolate()`. Body inspection ensures
  user-customized fixtures are NOT flagged.
- `scripts/migrate_config.py` — supplemental Python helper that
  translates `brownie-config.yaml` → `ape-config.yaml` for well-known
  fields (networks, solidity remappings/version, dependencies, dotenv).
  Renames the legacy file to `.legacy` so Ape doesn't re-pick it.
- `.github/workflows/test.yml` and `publish.yml` (CI fixture suite +
  OIDC-based publish on tag).
- `TRACK_3_ISSUE_DRAFT.md` — pre-written issue body for ApeWorX/ape
  asking for migration-guide reference (Track 3 of the hackathon).

### Changed
- `exceptions` removed from `IMPORT_NAMES_DROP` — Ape also exposes
  `ape.exceptions`, so the import is now kept (rewritten to ape) and
  only the class names need translation.

## [0.2.0] — 2026-04-28

`chain` API rewrites + FP hardening.

### Added
- **Pass 5: `chain.mine(N)` → `chain.mine(num_blocks=N)`** (positional
  → kwarg, single-arg only).
- **Pass 6: `chain.sleep(N)` → `chain.pending_timestamp += N`**
  (statement context only — left alone in expressions).
- 7 new fixtures (20–26): byte-string keys, dict-spread, dropped alias,
  chain.mine variants, chain.sleep variants.
- 3rd real-repo validation on
  [PatrickAlphaC/smartcontract-lottery](https://github.com/PatrickAlphaC/smartcontract-lottery).

### Changed
- `stripPyStringQuotes` tightened to reject prefixed strings
  (`b"from"`, `f"from"`, `r"from"`) — only plain quoted strings are
  treated as tx-dict keys.
- `dropped` import names now preserve full `Name as Alias` form in the
  TODO comment, so the user can grep for either token.
- Pass 4 (tx-dict) rejects dicts containing dictionary-splat children
  (`{**other, "from": x}`).

## [0.1.0] — 2026-04-28

Initial submission. Six core passes covering imports, attribute renames,
`network.show_active()`, and tx-dict → kwargs.

### Added
- Pass 1: `from brownie import …` → `from ape import …` with name
  renames and contract-name heuristic dropping.
- Pass 2a/b: `brownie.network.show_active()` and bare
  `network.show_active()` → `networks.active_provider.network.name`.
- Pass 3 / 3b: `brownie.<known_attr>` → `ape.<attr>`; `import brownie`
  → `import ape` when Pass 3 fired.
- Pass 4: tx-dict → kwargs with `TX_DICT_KEYS` whitelist + `"from"`
  required guard.
- 19 fixture tests, all passing.
- 2 real-repo validation
  ([brownie-mix/token-mix](https://github.com/brownie-mix/token-mix),
  [PatrickAlphaC/brownie_fund_me](https://github.com/PatrickAlphaC/brownie_fund_me)).
- README, CASE_STUDY.md, SUBMISSION.md, CLAUDE.md.
