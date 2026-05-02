# Contributing to brownie-to-ape

The codemod is intentionally a single-file transform (`scripts/codemod.ts`)
with a flat fixture suite (`tests/fixtures/NN-name/{input,expected}.py`).
This keeps it readable, easy to PR, and aligned with how `jssg` codemods
are typically structured.

## ⚡ Quick start (3 minutes)

```bash
# 1. Clone & install dev deps
git clone https://github.com/PugarHuda/brownie-to-ape && cd brownie-to-ape
npm install

# 2. Run the full test suite (77 fixture + 117 Vitest + 29 pytest = 223 tests)
npm test                # jssg snapshot tests
npm run test:unit       # Vitest unit + property + qa
python -m pytest tests/ # Python unittests for migrate_config.py

# 3. Make a change (TDD — write the fixture FIRST)
mkdir tests/fixtures/78-my-new-pattern
echo "# my brownie input" > tests/fixtures/78-my-new-pattern/input.py
echo "# my ape expected"  > tests/fixtures/78-my-new-pattern/expected.py
npm test  # confirm it fails as expected, then implement in scripts/codemod.ts
```

Expected feedback loops:
- jssg fixture suite: ~1 second
- Vitest suite: ~2 seconds
- pytest suite: <1 second
- Full local test:all: ~5 seconds

## Where things live

```
brownie-to-ape/
├── scripts/
│   ├── codemod.ts          ← THE ONE FILE you'll edit for new transforms
│   ├── migrate_config.py   ← YAML config helper (separate concern)
│   ├── benchmark.sh        ← multi-repo timing benchmark
│   └── preview.sh          ← dry-run wrapper for end users
├── tests/
│   ├── fixtures/<NN>-<name>/{input,expected}.py  ← jssg snapshot pairs
│   ├── unit/pure-helpers.test.ts                 ← Vitest helper tests
│   ├── property/{determinism,idempotency}.test.ts
│   ├── qa/{version-consistency,docs-integrity,perf-budget,golden-master}.test.ts
│   ├── test_migrate_config.py                    ← legacy unittest
│   └── test_migrate_config_pytest.py             ← Describe* pytest
├── workflow.yaml           ← Codemod CLI workflow definition
├── codemod.yaml            ← package metadata
└── docs/
    ├── index.html          ← live demo (deployed at pugarhuda.github.io/brownie-to-ape/)
    └── TESTING_PROMPT.md   ← test-suite generation prompt for AI agents
```

## Adding a new transform pass

1. **Decide the pattern.** Find an `ast-grep` pattern that matches the
   Brownie idiom you want to rewrite. The
   [Codemod docs](https://docs.codemod.com/jssg/intro) and the
   [ast-grep playground](https://ast-grep.github.io/playground.html)
   (set language to Python) are the fastest ways to iterate.

2. **Decide the safe-context check.** Most passes need to filter on
   the parent node kind to avoid clobbering edits or breaking syntax.
   Reference patterns in `scripts/codemod.ts`:
   - **Method-call only** (Pass 4): `funcNode.kind() === "attribute"`
   - **Inside dictionary** (Pass 3): walk ancestors checking for
     `dictionary` (so we don't double-rewrite inside tx-dicts)
   - **Statement context** (Pass 6, Pass 7): parent is
     `expression_statement` or assignment RHS — used for inline TODO
     appends and for transforms that change semantics in expression
     contexts.

3. **Replace the smallest range possible.** The closing-paren strategy
   used by `appendInlineTodoToCalls` (Passes 7, 9, 10) is the canonical
   way to annotate a call without clobbering edits to its args.
   Replacing the full call text is almost always wrong — it loses any
   sibling-pass edits inside the args.

4. **Add a fixture pair BEFORE the implementation.** Create
   `tests/fixtures/NN-pass-name/input.py` and `expected.py`. Run
   `npx codemod@latest jssg test -l python ./scripts/codemod.ts ./tests/fixtures`
   and watch it fail. Then write the pass.

5. **Add a NEGATIVE fixture.** For every transform, write a fixture
   that proves the pass does NOT fire in a context where it would be a
   false positive. See e.g. `13-wildcard-import-skipped`,
   `21-spread-in-tx-dict`, `26-chain-sleep-in-expression`,
   `29-exceptions-unknown-untouched`, `39-orderdict-not-tx-dict`,
   `40-helper-function-not-method`. The `0` in our "0 FP" claim depends
   on these existing.

6. **Document in CHANGELOG.md** under the appropriate version
   (`Unreleased` heading until the next tag).

## Validating on real repos

Before merging a substantive change, regenerate the benchmark:

```bash
bash scripts/benchmark.sh
```

This re-clones the four reference repos and times the codemod against
each. Compare `benchmark/results.md` to the previous run — the diff
should show identical or improved coverage and identical (zero) FP
count.

To audit FPs, eyeball the diff of each repo:

```bash
cd benchmark/repos/<repo-name>
git diff -- '*.py' | less
```

Anything that looks suspicious (incorrect rewrite, broken syntax,
unintended side effect) must be addressed before the PR lands.

## Adding a new fixture pattern

Two layouts are supported by the jssg test runner:

- **Single-file:** `tests/fixtures/NN-name/{input,expected}.py`
- **Directory:** `tests/fixtures/NN-name/{input,expected}/...py` (use
  for multi-file or rename scenarios)

We've used single-file for everything so far; the directory form is
rarely needed.

## Style

- TypeScript: prefer `Set<string>` and `Record<string, string>` over
  inline literals when the data is referenced from multiple passes.
- Comments: lead with **why**, not **what**. The pass-header comments
  (`Transform N: …`) explain ordering decisions and trade-offs that
  the code alone can't convey.
- Tests: name fixtures with a 2-digit prefix to keep them in run
  order. Prefix matches version: a fixture added in v0.X.Y starts at
  the next free number.

## Publishing a release

1. Update `version` in `codemod.yaml` (SemVer).
2. Update `CHANGELOG.md` — move `Unreleased` content to a new
   versioned heading.
3. Tag and push:
   ```bash
   git tag v0.X.Y
   git push --tags
   ```
4. The `.github/workflows/publish.yml` workflow runs `codemod publish`
   via OIDC trusted publishing.
5. Verify the package appears at `https://app.codemod.com/registry/<scope>/brownie-to-ape`.

## Scope

In scope:
- Anything in the Brownie → Ape migration path (imports, API renames,
  syntax rewrites, deprecation TODOs).
- Helper scripts (config converter, benchmark) that improve the
  migration UX.

Out of scope:
- Migrating other framework pairs (those should be separate codemod
  packages).
- Modifying `web3.py` patterns — that's a different framework
  upgrade ([web3.py v6→v7](https://web3py.readthedocs.io/en/stable/v7_migration.html)).
- Auto-completing the migration (e.g. `accounts.add` rewrite needs
  three Ape arguments that can't be inferred from the Brownie call).
