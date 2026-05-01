# Testing & QA Prompt — brownie-to-ape codemod

> **How to use this document:** Copy the entire content below the `---`
> divider into an AI agent conversation (Claude, GPT, Cursor, or similar)
> together with the codebase. The agent should generate a comprehensive
> test suite that meets every requirement spelled out here. This document
> is also the human review checklist for any test PR.

---

## ROLE

You are a senior QA / test architect with deep experience in:

- AST-based code transformation tools (codemods, jscodeshift, ast-grep)
- Property-based testing and snapshot testing
- TypeScript + Python toolchains
- Cross-platform CI (Linux/macOS/Windows)
- Hackathon evaluation criteria with adversarial review

You will design and implement a test suite for the `brownie-to-ape`
codemod. The submission is judged with a scoring formula that **heavily
penalizes false positives**, so test discipline is the top priority.

---

## 1. PROJECT CONTEXT (read fully before writing any test)

### 1.1 What this project is

`brownie-to-ape` is a **code transformation tool** ("codemod") that
migrates Python smart-contract projects from the deprecated
[Brownie](https://eth-brownie.readthedocs.io/) framework to the
[ApeWorx Ape](https://docs.apeworx.io/) framework.

- **Input:** a Brownie project (Python 3.9+ source files)
- **Output:** the same project with Brownie patterns rewritten to Ape
  equivalents, plus inline `# TODO(brownie-to-ape):` comments for
  patterns that can't be safely auto-rewritten

### 1.2 Stack

| Layer | Tech |
|---|---|
| Codemod platform | [Codemod CLI](https://docs.codemod.com/) (the official toolkit) |
| Engine | `jssg` (JavaScript ast-grep) — **NOT jscodeshift** (banned) |
| Parser | Tree-sitter Python grammar |
| Runtime | Sandboxed QuickJS/LLRT (no fs/network unless granted) |
| Transform code | `scripts/codemod.ts` (~870 LOC, 17 ordered passes) |
| Helper script | `scripts/migrate_config.py` (PyYAML, brownie-config → ape-config) |
| Existing tests | 62 jssg fixture pairs (`tests/fixtures/<NN-name>/{input,expected}.py`) + 13 Python `unittest` cases |
| CI | GitHub Actions (Linux Ubuntu, Node 22) |

### 1.3 Critical constraints

- **The codemod is a pure function**: source string → source string. No
  database, no network, no Redis, no RabbitMQ, no financial
  calculations. Testing patterns from stateful services (real-DB
  integration tests, queue mocking, etc.) **do not apply**.
- **Sandboxed runtime**: the transform runs in QuickJS without standard
  Node APIs. No `fs`, no `process.env`, no `console.log` reliably. Tests
  that exercise Node-specific APIs are out of scope.
- **17 transform passes** are ordered and stateful only via the `edits`
  array. Order matters because edits on overlapping AST ranges produce
  undefined behavior.

### 1.4 Hackathon scoring formula

```
Score = 100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))
```

- **FP (false positive)** = an incorrect change. **Heavily penalized.**
- **FN (false negative)** = a missed pattern. Penalized lightly.
- **N** = total patterns in the repo.
- **wFP / wFN** = penalty weights, with `wFP ≫ wFN`.

**Implication for testing:** every transform pass MUST have at least one
**negative test** that proves it does NOT fire in a context where it
would be a false positive. Coverage of negative cases is more important
than coverage of positive cases.

### 1.5 What the codemod migrates (17 passes, current state)

1. `from brownie import …` → `from ape import …` with name renames
   (`network → networks`), constants moved to `ape.utils` (`ZERO_ADDRESS`),
   contract artifacts dropped + auto-add `project`, `web3` preserved with
   inline TODO.
2. **2a.** `brownie.network.show_active()` → `networks.active_provider.network.name`
   **2b.** bare `network.show_active()` → same
   **2c.** `exceptions.<KnownClass>` → `exceptions.<MappedClass>` (and
   qualified `brownie.exceptions.X` form) plus top-of-file TODO listing
   any unknown exception names.
3. `brownie.<known_attr>` → `ape.<attr>` for `{reverts, accounts, project,
   config, chain}`, skipping inside dictionary literals.
   **3b.** bare `import brownie` → `import ape` if Pass 3 fired.
4. tx-dict → kwargs: `Contract.deploy(arg, {"from": x, "value": v})` →
   `Contract.deploy(arg, sender=x, value=v)`. Method-call only,
   tx-dict-key whitelist, dict-spread guard.
5. `chain.mine(N)` (positional) → `chain.mine(num_blocks=N)`
6. `chain.sleep(N)` (statement context) → `chain.pending_timestamp += N`
7. `accounts.add(...)` → inline TODO appended to closing `)` (safe-context
   guard: expression_statement or assignment RHS only)
   **7b.** `accounts.at(addr, force=True)` → `accounts.impersonate_account(addr)`
8. Brownie `def isolate(fn_isolation): pass` fixture → top TODO if body
   is trivial (pass + optional docstring); user-customized bodies left
   alone.
9. `Wei("X")` → `convert("X", int)` + auto-inject `from ape.utils import
   convert` (deduplicated).
10. `interface.X(addr)` → inline TODO at safe context.
11. (reserved)
12. `Web3.toWei(...)` / `Web3.fromWei(...)` → inline TODO.
13. `tx.events[N][key]` → `tx.events[N].event_arguments[key]` (integer
    inner key).
14. `tx.events["Name"][key]` → `[log for log in tx.events if log.event_name
    == "Name"][0].event_arguments[key]` (string inner key).
15. project containers (when `from ape import project` exists or was
    auto-added):
    - `<Uppercase>[-1]` → `project.<Uppercase>.deployments[-1]`
    - `len(<Uppercase>)` → `len(project.<Uppercase>.deployments)`
    - `<Uppercase>.at(addr)` → `project.<Uppercase>.at(addr)`
16. `web3.eth.get_balance(X)` → `chain.get_balance(X)` + auto-inject
    `from ape import chain` (deduplicated).

### 1.6 Validated repos (5 OSS, all currently 0 FP)

| Repo | Shape | .py modified |
|---|---|---|
| brownie-mix/token-mix | Token tutorial | 4 / 5 |
| PatrickAlphaC/brownie_fund_me | Oracle | 5 / 6 |
| PatrickAlphaC/smartcontract-lottery | Multi-network + VRF | 5 / 7 |
| PatrickAlphaC/aave_brownie_py_freecode | DeFi (Aave) | 4 / 5 |
| yearn/brownie-strategy-mix | Yearn DeFi template | 4 / 7 |

---

## 2. NAMING CONVENTION (strict)

```
describe('<methodNameOrPassName>', () => {
  describe('positive cases', () => {
    test('<expected behavior in single sentence>', () => { ... });
    test('<another expected behavior>', () => { ... });
  });

  describe('negative cases', () => {
    test('does NOT fire when <FP-risk context>', () => { ... });
    test('does NOT fire when <another FP-risk context>', () => { ... });
  });

  describe('edge cases', () => {
    test('handles <boundary condition>', () => { ... });
  });
});
```

For Python (pytest):

```python
class DescribeStripPyStringQuotes:
    class DescribePositiveCases:
        def test_simple_double_quoted_string_returns_inner(self): ...
        def test_simple_single_quoted_string_returns_inner(self): ...

    class DescribeNegativeCases:
        def test_does_not_strip_b_string_returns_none(self): ...
        def test_does_not_strip_f_string_returns_none(self): ...

    class DescribeEdgeCases:
        def test_handles_triple_quoted_string(self): ...
        def test_handles_empty_string(self): ...
```

**Rules:**

1. Every test name is a single declarative sentence describing the
   *expected* behavior. No "should" prefixes (we test what IS, not what
   "should be").
2. Negative test names start with `does NOT` or `is NOT` to make
   intent unmistakable in test output.
3. One assertion per test where possible. If multiple assertions are
   needed, they must all verify the same behavior from different angles.
4. Test bodies are arrange / act / assert with blank-line separation.
5. Magic numbers and strings live in named constants at the top of the
   describe block.

---

## 3. TEST TAXONOMY (10 categories)

### 3.1 Pure helper unit tests — Vitest, no mocks needed

The following helpers in `scripts/codemod.ts` are pure functions and
require **NO MOCKS** (London-school strict mocking is counter-productive
here — the functions have no collaborators):

- `stripPyStringQuotes(literal: string): string | null`
- `applyAttrRenamesToText(text: string): string`
- `isLikelyContractName(name: string): boolean`

For each: ≥3 positive cases, ≥3 negative cases, ≥2 edge cases.

### 3.2 AST-helper tests — Vitest, mock `SgNode` interface

These helpers interact with the ast-grep API:

- `isInsideDictionary(node)`
- `appendInlineTodoToCalls(rootNode, edits, pattern, suffix)`

Provide a minimal in-memory mock of the `SgNode` shape (parent, kind,
text, field, children) sufficient to exercise the helpers in
isolation. Mock fixtures should mirror real Tree-sitter Python output
for the cases under test.

### 3.3 Per-pass fixture tests — jssg test runner (existing, EXTEND)

Each of the 17 transform passes must have:

- **≥3 positive cases** (typical happy paths)
- **≥3 negative cases** (FP-risk contexts where the pass must NOT fire)
- **≥1 edge case** (boundary condition: empty input, trailing comma,
  multi-line, mixed quotes, async/await wrapping, walrus, list
  comprehension, lambda body, etc.)

Total target: ≥17 × 7 = **≥120 fixture pairs** (currently 62 — needs
roughly 60 more).

### 3.4 Cross-pass composition tests

Verify pass ordering and edit-overlap behavior:

- **Test:** "Pass 13 fires before Pass 14 on `tx.events[0]['x']`-shaped
  input but not on `tx.events['Name']['x']`" (integer vs string inner
  key disambiguation).
- **Test:** "Pass 7's `appendInlineTodoToCalls` replaces only the closing
  `)` token, leaving inner edits from Pass 2b intact" (closing-paren
  strategy verification).
- **Test:** "Pass 1's auto-add `project` is observable to Pass 15
  via the `addedProjectImport` flag" (cross-pass state).
- **Test:** "Pass 9 + Pass 16 both add prelude imports without
  duplicating when both fire on the same file" (prelude addition
  deduplication).

### 3.5 Property-based / invariant tests

Use [`fast-check`](https://github.com/dubzzz/fast-check) for TypeScript or
[`hypothesis`](https://hypothesis.readthedocs.io/) for Python.

- **Idempotency:** for any input that the codemod transforms,
  `codemod(codemod(x)) === codemod(x)`. Running the codemod twice on the
  same file produces no further changes.
- **Determinism:** the codemod is order-independent. For any input, two
  runs produce byte-identical output.
- **Monotonicity:** adding a new pass cannot reduce coverage on existing
  fixture tests. Asserted by re-running the full fixture suite as a
  regression gate after any helper change.
- **Numeric-literal preservation** (the codemod's "financial" analog —
  see §6 below): for any tx-dict transform, the value text after
  transformation is byte-identical to the input value text. No
  rounding, no float coercion, no scientific-notation normalization.
- **Comment preservation outside transformed nodes:** comments not on
  rewritten lines are preserved exactly.
- **Encoding preservation:** input UTF-8 → output UTF-8, no BOM
  insertion or stripping.

### 3.6 Real-repo regression tests

For each of the 5 reference repos (token-mix, brownie_fund_me,
smartcontract-lottery, aave_brownie_py_freecode, yearn-strategy-mix):

- Clone at a pinned commit SHA (do NOT use `--depth 1` or `HEAD` — pin)
- Run codemod
- Assert: number of files modified, number of lines added/removed, and
  full diff hash match a recorded golden master.
- Diff golden masters live in `tests/golden/<repo-name>.diff` and are
  re-generated by hand only when the maintainer accepts a behavior
  change.

### 3.7 Performance / SLO tests

- **Per-file SLO:** transform completes in ≤500 ms p99 (no file in 5
  reference repos exceeds this).
- **Per-repo SLO:** codemod CLI workflow completes in ≤5 s wall-clock
  on a warm machine (excluding `npx` first-time download).
- **Memory:** transform completes within 256 MB heap.

Run via `scripts/benchmark.sh` (existing) extended to record `time`,
RSS, and assert against thresholds.

### 3.8 Cross-platform CI tests

GitHub Actions matrix:

```yaml
strategy:
  matrix:
    os: [ubuntu-22.04, ubuntu-24.04, macos-14, windows-2022]
    node: [20, 22]
```

Run the full fixture suite on each cell. Verify identical output
byte-for-byte across platforms (no LF/CRLF surprises, no path
separator leaks).

### 3.9 Build verification (downstream — Docker required)

For each migrated reference repo:

- Build a Docker image with `python:3.13-slim` + `pip install eth-ape`
- Mount the migrated repo
- Run `ape compile` and `ape test`
- Assert exit code 0 (or document expected failures with comments)

This is the **strongest signal** that the codemod's output is
runnable. Implement as a separate workflow `ape-verify.yml` (slower —
runs nightly, not on every PR).

### 3.10 Documentation tests

- **README code blocks:** every fenced ```bash``` and ```python``` block
  in README.md, DEMO.md, and CASE_STUDY.md must be either runnable
  (executed in CI) or marked `<!-- doctest:skip -->` with a reason.
- **DEMO.md ↔ fixtures coherence:** every "before/after" pair in
  DEMO.md must correspond to an actual `tests/fixtures/<NN>/{input,expected}.py`
  pair. Verified by a script that parses the DEMO.md fenced blocks and
  diffs them against the fixtures.
- **CHANGELOG ↔ git tags coherence:** every git tag `v*` has a matching
  `## [vX.Y.Z]` heading in CHANGELOG.md. Verified by a script in CI.
- **Live links:** every URL in README, DEMO, CASE_STUDY, SUBMISSION,
  TRACK_3_ISSUE_DRAFT, EVALUATOR.md returns a non-404 status. Run as a
  weekly GitHub Action with allowlist for known-flaky external URLs.

---

## 4. PER-PASS TEST SPEC (detailed)

For each pass below, write the tests in this order: 3 positive, 3
negative, 1+ edge. Use the naming convention from §2.

### Pass 1 — `from brownie import …` rewrite

#### Positive (must fire)
- `from brownie import accounts` → `from ape import accounts`
- `from brownie import network, chain, project, config` → renames `network` → `networks`
- `from brownie import accounts as acc` (preserves alias)
- `from brownie import (\n    accounts,\n    network,\n)` (multi-line — comments inside MAY be lost; document)
- `from brownie import ZERO_ADDRESS` → `from ape.utils import ZERO_ADDRESS`
- `from brownie import ZERO_ADDRESS, accounts` → 2 lines (ape.utils + ape)
- `from brownie import FundMe, accounts, network` → drops contract + auto-adds `project`
- `from brownie import web3` → preserved with inline TODO

#### Negative (must NOT fire)
- `from ape import accounts` (already migrated)
- `from brownie.network import gas_price` (submodule — regex `^brownie$` doesn't match)
- `from brownie import *` (wildcard — explicitly skipped)
- `# from brownie import accounts` (comment)
- `s = "from brownie import accounts"` (string literal)
- `from somelib import brownie` (different shape)
- `from brownie_helper import x` (substring match must fail)

#### Edge
- `from brownie import (accounts,)` (trailing comma)
- `from brownie import accounts;` (trailing semicolon)
- `from brownie import accounts ,network` (extra whitespace)
- file with leading BOM (`﻿`)
- file in CRLF line endings
- file ending without final newline

### Pass 2a — `brownie.network.show_active()`

(repeat the structure: 3 positive, 3 negative, 1+ edge)

### Pass 2b — bare `network.show_active()`

#### Negative — CRITICAL
- file does NOT have any brownie reference at all → must NOT fire even if `network.show_active()` text appears (file-marker guard).

### Pass 4 — tx-dict → kwargs

This is the highest-risk pass. Negative test inventory must be
**exhaustive**:

#### Negative
- `OrderedDict({"from": "alice"})` (dict constructor, not method call)
- `dict({"from": "alice"})` (dict constructor)
- `defaultdict(int, {"from": "alice"})` (constructor)
- `partial(f, {"from": "alice"})` (functools.partial — not method call)
- `helper({"from": "alice"})` (module-level function call)
- `c.method({"from": "alice"}, **kwargs)` (kwargs unpacking — not last positional, but careful)
- `c.method({**other, "from": "x"})` (dict spread — must skip)
- `c.method({"name": "alice", "from": "x"})` (non-tx-dict-key present)
- `c.method({b"from": "x"})` (b-string key)
- `c.method({f"from": "x"})` (f-string key)
- file with brownie text in string literal only (file-marker guard)

#### Positive — value preservation (numeric)
- `c.method(arg, {"from": x, "value": 0})` → `c.method(arg, sender=x, value=0)` — zero
- `c.method(arg, {"from": x, "value": 1})` → integer
- `c.method(arg, {"from": x, "value": 1e18})` → scientific notation **PRESERVED EXACTLY** (no eager int conversion)
- `c.method(arg, {"from": x, "value": 0.1 * 10**18})` → expression preserved
- `c.method(arg, {"from": x, "value": 2**256-1})` → max-int boundary
- `c.method(arg, {"from": x, "value": Wei("1 ether")})` → nested Wei call inside dict (Pass 9 fires on the inner Wei)
- `c.method(arg, {"from": x, "value": chain.balance})` → chain attribute access preserved

### Pass 7 — `accounts.add(...)` inline TODO

#### Negative — context guards
- `if accounts.add(pk) is not None:` (inside `if`-condition — parent is comparison, not assignment)
- `result = [accounts.add(p) for p in pks]` (list comprehension)
- `adder = lambda pk: accounts.add(pk)` (lambda body)
- `if (acc := accounts.add(pk)):` (walrus inside if)
- `await accounts.add(pk)` (await expression — different parent)
- `accounts.add(pk).balance()` (chained call — parent is attribute)

(Continue for Passes 7b, 8, 9, 10, 12, 13, 14, 15, 16 with same rigor.)

### Pass 16 — `web3.eth.get_balance(X)` → `chain.get_balance(X)`

#### Negative
- `chain.get_balance(X)` (already migrated — must not double-rewrite)
- `web3.eth.get_block(X)` (different method on web3.eth)
- `web3.eth.get_balance` without parens (just attribute access, not call)
- file does NOT have `from brownie import web3` (preservation guard) → must NOT fire

#### Edge
- `web3.eth.get_balance(addr, block_identifier="latest")` (kwarg present — should still fire? document the contract)

---

## 5. CROSS-CUTTING INTEGRATION TESTS

### 5.1 `migrate_config.py` (Python helper)

Currently 13 unittests. Migrate to **pytest** with the same naming
convention. Required additions:

#### Negative cases (validation logic)
- malformed YAML (broken indentation) → exits with code 4, writes nothing
- file unreadable (permissions) → exits with code 3
- YAML parses to a string instead of a dict → exits with code 5
- YAML parses to a list at top level → exits with code 5
- destination `ape-config.yaml` already exists → writes `.new` suffix and warns
- legacy rename fails (file in use on Windows) → exits 0 with warning
- empty `brownie-config.yaml` → produces minimal `ape-config.yaml` with no errors

#### Edge cases
- comments-only YAML (no actual config)
- YAML anchors and aliases
- nested config 4 levels deep (recursive translation)

### 5.2 Workflow + codemod metadata schema validation

- **Test:** `codemod.yaml` validates against the schema published at
  `https://raw.githubusercontent.com/codemod/codemod/main/schemas/codemod.json`.
- **Test:** `workflow.yaml` validates against the workflow schema.
- **Test:** Version in `codemod.yaml` matches the latest git tag.
- **Test:** Version in `package.json` matches `codemod.yaml`.

### 5.3 Registry publish smoke test

Triggered from the publish workflow on tag push. After
`codemod publish` succeeds:

- Wait 30 s for registry indexing
- Run `npx codemod@latest search '@pugarhuda'` and assert the new version
  appears
- Pull the package and run the fixture suite against it (i.e., verify
  that the published artifact actually works)

### 5.4 GitHub Pages live demo

- **Test:** `https://pugarhuda.github.io/brownie-to-ape/` returns HTTP
  200
- **Test:** the page contains the badge "v0.7.6" (or current version)
- **Test:** all internal anchor links resolve
- **Test:** all external links return non-404 (allowlist for flaky)

---

## 6. NUMERIC LITERAL PRESERVATION TESTS

The codemod does NOT perform numeric calculations, but **must not
modify numeric literals** during text rewriting. This is the
codemod-equivalent of "precision loss / rounding error" tests.

For every tx-dict, Wei, and chain.* transform, write tests that pass
these numeric values **unchanged** through the transform:

| Input value text | Must appear in output text |
|---|---|
| `0` | `0` |
| `1` | `1` |
| `1_000_000_000_000_000_000` (Python underscores in numerics) | exactly preserved |
| `1e18` | `1e18` (NOT `1000000000000000000`) |
| `0.1 * 10 ** 18` | exactly preserved |
| `2 ** 256 - 1` | exactly preserved |
| `0x1A` (hex) | `0x1A` |
| `0b10` (binary) | `0b10` |
| `0o7` (octal) | `0o7` |
| `Decimal("0.000000000000000001")` | exactly preserved |

This list IS the precision/rounding-error test catalog for this
codemod. None of the codemod's outputs should ever be a numeric
*calculation* of the input — only string passthrough is allowed.

---

## 7. ANTI-PATTERNS (do NOT do)

- **Do NOT mock the AST itself in fixture tests.** Use the real
  Tree-sitter Python parser via the jssg test runner. AST mocking is
  only for unit-level helper tests.
- **Do NOT test the Codemod CLI internals** (vendor responsibility).
- **Do NOT test ast-grep internals** (vendor responsibility).
- **Do NOT test Python language semantics** (e.g., "does Python parse
  walrus correctly"). Test only what *our transforms* do.
- **Do NOT use random Python files from the internet** without a
  pinned commit SHA. Tests must be reproducible.
- **Do NOT skip negative tests** "because positive tests cover it".
  Negative tests are how we verify FP-discipline.
- **Do NOT use `--depth 1` or `HEAD` for clone-and-test**. Pin commit
  SHA. Repos can change underneath you.
- **Do NOT make tests depend on network** (except the optional registry
  / Pages smoke tests, which run in a separate CI job and tolerate
  flake).
- **Do NOT use snapshot tests as a substitute for assertions**. A
  snapshot is appropriate for fixture tests (the output IS the
  contract); for unit tests, write explicit assertions.
- **Do NOT mock AST nodes when the function is pure** (e.g.,
  `stripPyStringQuotes` takes a string and returns a string — there is
  nothing to mock).
- **Do NOT add tests for behavior we don't claim**. Document any "by
  design" non-behavior in CHANGELOG and write a NEGATIVE test for it.

---

## 8. TOOLING SPEC

### 8.1 TypeScript (Vitest)

```bash
npm i -D vitest @types/node fast-check
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 95,
        branches: 90,
        functions: 95,
        statements: 95,
      },
    },
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});
```

### 8.2 Python (pytest)

```bash
pip install pytest pytest-cov hypothesis
```

`pytest.ini`:

```ini
[pytest]
testpaths = tests
python_classes = Describe*
python_functions = test_*
addopts = --cov=scripts.migrate_config --cov-report=term-missing --cov-fail-under=95
```

### 8.3 Mutation testing (Stryker)

```bash
npm i -D @stryker-mutator/core @stryker-mutator/typescript-checker @stryker-mutator/vitest-runner
```

`stryker.conf.json`:

```json
{
  "mutate": ["scripts/codemod.ts"],
  "testRunner": "vitest",
  "thresholds": { "high": 80, "low": 60, "break": 50 }
}
```

Mutation tests run weekly, not on every PR (slow).

### 8.4 Build verification (Docker)

`Dockerfile.ape`:

```dockerfile
FROM python:3.13-slim
RUN pip install --no-cache-dir eth-ape ape-solidity ape-foundry
WORKDIR /work
ENTRYPOINT ["bash", "-lc"]
```

Use:

```bash
docker build -f Dockerfile.ape -t brownie-to-ape-verify .
docker run --rm -v "$(pwd):/work" brownie-to-ape-verify "ape compile && ape test -v"
```

### 8.5 CI matrix

```yaml
# .github/workflows/test.yml (extended)
strategy:
  matrix:
    os: [ubuntu-22.04, ubuntu-24.04, macos-14, windows-2022]
    node: [20, 22]
  fail-fast: false
```

---

## 9. DELIVERABLES CHECKLIST

### TypeScript unit tests

- [ ] `tests/unit/stripPyStringQuotes.test.ts`
- [ ] `tests/unit/applyAttrRenamesToText.test.ts`
- [ ] `tests/unit/isLikelyContractName.test.ts`
- [ ] `tests/unit/isInsideDictionary.test.ts` (with mock SgNode)
- [ ] `tests/unit/appendInlineTodoToCalls.test.ts` (with mock SgNode)

### Per-pass fixture extensions (≥60 new fixtures total)

- [ ] Pass 1: ≥7 positive, ≥7 negative, ≥3 edge
- [ ] Pass 2a, 2b, 2c: ≥3+3+1 each
- [ ] Pass 3, 3b: ≥3+3+1 each
- [ ] Pass 4: ≥7 positive, ≥10 negative (highest FP risk), ≥3 edge
- [ ] Passes 5, 6: ≥3+3+1 each
- [ ] Passes 7, 7b: ≥3+3+1 each
- [ ] Pass 8: ≥3+3+1
- [ ] Passes 9, 10, 12, 13, 14, 15, 16: ≥3+3+1 each

### Property-based tests

- [ ] `tests/property/idempotency.test.ts`
- [ ] `tests/property/determinism.test.ts`
- [ ] `tests/property/numeric-literal-preservation.test.ts`
- [ ] `tests/property/comment-preservation.test.ts`

### Real-repo regression tests

- [ ] `tests/regression/token-mix.test.ts`
- [ ] `tests/regression/brownie_fund_me.test.ts`
- [ ] `tests/regression/smartcontract-lottery.test.ts`
- [ ] `tests/regression/aave_brownie_py_freecode.test.ts`
- [ ] `tests/regression/yearn-strategy-mix.test.ts`
- [ ] `tests/golden/<repo>.diff` for each (golden master)

### Integration / cross-cutting

- [ ] `tests/integration/composition.test.ts` (pass ordering + edit overlap)
- [ ] `tests/integration/registry-publish-smoke.test.ts`
- [ ] `tests/integration/github-pages-live.test.ts`

### Performance

- [ ] `tests/perf/per-file-slo.test.ts`
- [ ] `tests/perf/per-repo-slo.test.ts`

### Docs

- [ ] `tests/docs/readme-code-blocks.test.ts`
- [ ] `tests/docs/demo-fixtures-coherence.test.ts`
- [ ] `tests/docs/changelog-tags-coherence.test.ts`
- [ ] `tests/docs/external-links.test.ts` (weekly job)

### Python

- [ ] `tests/test_migrate_config.py` (migrated from `unittest` to `pytest` with `Describe*` classes)
- [ ] `tests/test_migrate_config_negative.py` (every error path)
- [ ] `tests/test_migrate_config_property.py` (Hypothesis: any valid YAML → any output, no crashes)

### CI

- [ ] `.github/workflows/test.yml` updated with matrix
- [ ] `.github/workflows/mutation.yml` (weekly Stryker)
- [ ] `.github/workflows/ape-verify.yml` (nightly Docker build)
- [ ] `.github/workflows/links.yml` (weekly external link check)

### QA / non-functional

- [ ] `tests/qa/license-present.test.ts`
- [ ] `tests/qa/version-consistency.test.ts` (codemod.yaml ↔ CHANGELOG ↔ git tag ↔ package.json)
- [ ] `tests/qa/no-secrets-in-history.test.ts` (regex scan for API keys, tokens; trufflehog or similar)
- [ ] `tests/qa/changelog-entry-per-tag.test.ts`
- [ ] `tests/qa/dependency-audit.test.ts` (npm audit + pip-audit)

---

## 10. ACCEPTANCE CRITERIA

A test PR is accepted when ALL of the following are true:

1. **All tests pass on Linux + Windows + macOS** (matrix CI green)
2. **Coverage thresholds met**:
   - Pure helpers: ≥95 % line + ≥90 % branch
   - Pass logic: 100 % pass coverage (every pass has at least one
     positive and one negative test)
   - migrate_config.py: ≥95 % line
3. **Zero false positives** across all 5 reference repos (verified via
   diff golden-master)
4. **Mutation score ≥80 %** on pure helpers (Stryker)
5. **Idempotency property holds** (`codemod^2 == codemod` on all 5 repos)
6. **Performance SLOs met**:
   - Per file: <500 ms p99
   - Per reference repo: <5 s warm wall-clock
7. **Documentation tests pass**:
   - All README/DEMO/CASE_STUDY code blocks runnable or skip-marked
   - DEMO.md before/after pairs match fixtures byte-for-byte
   - CHANGELOG has an entry for every git tag
8. **External links non-404** (modulo allowlist)
9. **No new runtime dependencies** in the shipped codemod (test-only
   dev-deps OK)
10. **Naming convention enforced** by lint rule or grep check

---

## 11. REPORTING FORMAT

After running the full suite, output a markdown report to
`tests/REPORT.md` with:

```markdown
# Test Report — <commit-sha> — <date>

## Summary
- Suites run: N
- Tests passed: M / N
- Coverage: X % (line) / Y % (branch)
- Mutation score: Z %

## False positive audit (5 repos)
| Repo | FP count | FN count | Lines changed |
|---|---|---|---|
| token-mix | 0 | 1 | +55 −53 |
| ... |

## Performance breakdown
| Pass | p50 (µs) | p99 (µs) |
|---|---|---|
| Pass 1 | 120 | 410 |
| ... |

## Documentation drift
- README block #3: ✅ runnable
- DEMO.md "Example 5" → fixture 22 ✅ match
- ...

## New failures
[stack traces / diffs]

## Skipped tests
[with reasons]
```

Upload as a CI artifact and post the summary as a PR comment.

---

## 12. OUT OF SCOPE — explicit clarifications

The following are NOT applicable to this codemod and should NOT have
tests written for them, even if the test-template prompt mentions them
generically:

- **Database integration tests** (no DB)
- **Redis / RabbitMQ / message queue tests** (no queue)
- **HTTP API integration tests** (no HTTP)
- **Authentication / authorization tests** (no auth surface)
- **Multi-tenant isolation tests** (single user runs codemod locally)
- **Real-money financial transactions** (the codemod transforms code,
  it does not transact). The numeric-literal preservation tests in §6
  are the closest analog and ARE in scope.
- **Microservice contract tests** (single deliverable, no services)
- **Long-running daemon tests** (the codemod is a one-shot CLI)

If a contributor proposes a test in any of these categories, push back:
either reframe it as a test of an actual codemod behavior, or reject
as out-of-scope.

---

## 13. PROMPT TO AGENT — final instruction

Now generate the test suite. Work pass-by-pass through the 17 transform
passes. For each:

1. Read `scripts/codemod.ts` to find the pass code.
2. Identify the AST shape it matches and the conditions under which it
   fires / does not fire.
3. Write the unit tests (if any pure helpers are touched) and the
   fixture pairs in the order: positive → negative → edge.
4. After every pass, run the full test suite to verify no regression.
5. Commit each pass's tests as a separate commit with a clear message
   like `test(pass-N): add positive/negative/edge tests for <pass>`.
6. After all passes are covered, write the cross-pass composition
   tests, then the property-based tests, then the regression / docs /
   QA tests.

Ask the maintainer (mas Huda) for clarification BEFORE you write tests
in any of these situations:

- A pass's behavior in a corner case is ambiguous (e.g., what should
  Pass 4 do when the dict has both `"from"` and a non-tx-key —
  currently the whole pass aborts; document this in tests, but ask if
  it's intentional or a bug).
- You discover a real false positive while writing a negative test
  (this is the most valuable thing the test suite can find — STOP,
  document, then ask whether to fix the codemod or update the
  expected behavior).
- A property-based test fails on a synthesized input (e.g., Hypothesis
  finds a string with weird Unicode that breaks `stripPyStringQuotes`).

Report failures with full stack traces and a minimal reproducer. Do
NOT silently fix codemod bugs as part of writing tests — separate the
two: tests in one PR, codemod fixes in another, with the test PR
landing first as a failing-test "lock".
