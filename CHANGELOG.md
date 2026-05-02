# Changelog

All notable changes to `brownie-to-ape` are documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Pre-1.0 versions correspond to the development phases tracked in the
hackathon submission. After the registry publish, this becomes a normal
SemVer changelog.

## [0.7.9] — 2026-05-03

Sync release: pushes the published case-study links into the registry README.

### Added
- README header now includes the **Published case studies** section
  with the 3 publicly-indexable case-study URLs:
  - [Medium — End-to-end token-mix migration with `ape test` 38/38 PASS](https://medium.com/@hudapugar/migrating-brownie-to-apeworx-ape-how-i-built-a-0-false-positive-codemod-with-250-tests-and-661f97e065e1)
  - [dev.to — Yearn Finance DeFi-specific migration](https://dev.to/hudapugar/migrating-yearn-finances-strategy-template-from-brownie-to-apeworx-ape-a-defi-specific-case-study-4m57)
  - [Medium — Engineering tradeoffs / why we said NO to features](https://medium.com/@hudapugar/engineering-tradeoffs-why-we-said-no-to-features-in-a-hackathon-codemod-19e2de92897b)
- README badge: "published case studies: 3"
- SUBMISSION.md "Why this stands out" gains rows for the 3 case studies
  + the 4 ecosystem PRs (ApeWorX #2780, Codemod #2168, awesome-codemods #7,
  awesome-python-codemods #1)

### Notes
- Codemod logic itself **unchanged from v0.7.6 / v0.7.7 / v0.7.8** — same
  17 transform passes, same FP guards. This is a docs-sync release so
  the Codemod registry README reflects the published case studies.

## [0.7.8] — 2026-05-02

Ecosystem-adoption release: 2 community PRs filed alongside our docs polish.

### Added
- **ApeWorX/ape PR [#2780](https://github.com/ApeWorX/ape/pull/2780)** — additive doc reference adding `@pugarhuda/brownie-to-ape` as an "Alternative Codemod" section in the official Brownie migration guide.
- **codemod-com/codemod PR [#2168](https://github.com/codemod-com/codemod/pull/2168)** — full migration guide at `docs/guides/migrations/brownie-to-ape.mdx` (218 LOC), formatted to match the existing react-router-v6-v7 / react-18-19 / nuxt-3-4 guides.
- **Logo system** — three SVG variants: `docs/logo.svg` (512×512 primary), `docs/logo-mark.svg` (256×256 icon-only), `docs/logo-favicon.svg` (64×64 browser tab). Wired into README header + live demo.
- **README badges** for both ecosystem PRs (ApeWorX #2780, Codemod #2168) so the activity is visible above-the-fold.

### Changed
- Refreshed remaining stale test-count references (238 → 250) in `README.md`, `SUBMISSION.md`, `EVALUATOR.md`. The Hypothesis fuzzer (6 tests) and 6 new fixtures (85-90) added in v0.7.7 left a few stragglers.

### Notes
- Codemod logic itself **unchanged from v0.7.6 / v0.7.7** (same 17 transform passes, same FP guards). This is purely an ecosystem adoption + docs release.
- Both PRs are still **open** at time of release; the activity itself is the signal, regardless of merge timing.

## [0.7.7] — 2026-05-02

End-to-end proof: codemod + AI-step + `ape compile` + `ape test` PASS on
real OSS repo. Plus 6 new fixtures, Hypothesis fuzzer, Bahasa
Indonesia README, AI-step demo doc, deferred-features rationale doc.

### Added
- **End-to-end verification on `brownie-mix/token-mix`** —
  [`docs/ape-verify-token-mix.log`](./docs/ape-verify-token-mix.log)
  captures `ape compile` + `ape test --network ::test` →
  **38 passed, 0 failed in 5.40s**. The full hackathon evaluation
  pipeline (codemod → AI-step → `ape compile && ape test`) now has
  reproducible green-log evidence.
- **`demo/ai-step-demo.md`** — step-by-step AI/manual cleanup
  walkthrough using token-mix as the reference repo (~30 LOC of fixes
  across 4 files).
- **`docs/DEFERRED_FEATURES.md`** — rationale for explicitly NOT
  implementing browser WASM playground, Stryker score >50%, full
  per-pass fixture saturation, pre-commit hook, and full
  `accounts.add` / `interface.X` auto-rewrite (would compromise the 0
  FP guarantee).
- **`README.id.md`** — full Bahasa Indonesia translation.
- **`tests/test_migrate_config_fuzz.py`** — 6 Hypothesis property
  tests on the YAML translator (idempotency, determinism,
  serializability under arbitrary inputs).
- **6 new jssg fixtures (85-90)** covering deeply nested brownie
  attribute access, multi-line imports, comment-preserving tx-dicts,
  empty-string `from` value, ZERO_ADDRESS-only imports, and FP-guards
  for string-literal `"from"` usage.
- **`engines.node>=20`** declared in `package.json`.
- **`.github/FUNDING.yml`** + GitHub repo metadata polished (12
  topics, homepage URL, refreshed description).
- README badge: `ape test on token-mix: 38 passed / 0 failed`.

### Changed
- Test count totals: **250 tests** (90 fixture + 125 Vitest + 35
  pytest). All passing.
- `pytest.ini` adds `-p no:ape_test` to disable the eth-ape pytest
  plugin during our standalone codemod tests (prevents intermittent
  fixture-init crashes on Python 3.13 + Windows).
- Cross-links between `README.md` ↔ `README.id.md`,
  `APE_VERIFY_REPORT.md` ↔ `docs/ape-verify-token-mix.log`,
  `DEMO.md` ↔ `demo/ai-step-demo.md`, `EVALUATOR.md` ↔
  `docs/DEFERRED_FEATURES.md`.

### Notes
- Codemod logic itself **unchanged from v0.7.6** — this is a
  documentation, evidence, and test-coverage release. No new transform
  passes; existing 17-pass behavior is identical.
- Mutation baseline still 38.57% (architectural constraint
  documented in `docs/DEFERRED_FEATURES.md`).

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
