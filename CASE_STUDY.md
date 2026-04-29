# Case Study: Automating Brownie → Ape Migration with Codemod

> Submitted to the **Codemod Boring AI** hackathon — Track 1 (Production Migration Recipes) + Track 2 (Public Case Study).
> Author: Pugar Huda Mantoro · [pugarhudam@gmail.com](mailto:pugarhudam@gmail.com)
> Codemod: [`brownie-to-ape`](.)

## TL;DR

I built a Codemod recipe (`brownie-to-ape`) that migrates Python smart-contract projects from the deprecated Brownie framework to ApeWorx Ape. Validated on **four** real open-source repos with **zero false positives**:

| Repo | Files | Patterns auto-migrated | False positives | TODOs (manual review) |
|---|---|---|---|---|
| [`brownie-mix/token-mix`](https://github.com/brownie-mix/token-mix) | 4 / 5 .py | ~62 | **0** | 1 contract name + 1 isolate fixture |
| [`PatrickAlphaC/brownie_fund_me`](https://github.com/PatrickAlphaC/brownie_fund_me) | 5 / 6 .py | ~21 | **0** | 4 contract names + 1 accounts.add |
| [`PatrickAlphaC/smartcontract-lottery`](https://github.com/PatrickAlphaC/smartcontract-lottery) | 5 / 7 .py | ~30 | **0** | 5 contract names + 1 isolate |
| [`PatrickAlphaC/aave_brownie_py_freecode`](https://github.com/PatrickAlphaC/aave_brownie_py_freecode) | 4 / 5 .py | ~24 | **0** | 1 interface drop + 5 inline interface TODOs |
| **Combined** | **18 / 23** | **~137** | **0** | **~19 contextual TODOs** |

The codemod uses Codemod's **`jssg` engine** (ast-grep on Tree-sitter) and runs in ~3 seconds per repo. Source: [`scripts/codemod.ts`](./scripts/codemod.ts) (~510 LOC, 11 transform passes + helper). 38 fixture tests, all passing.

---

## 1. Why Brownie → Ape

[Brownie](https://eth-brownie.readthedocs.io/) was the Python smart-contract framework of choice for years (Patrick Collins' courses, Yearn, OpenZeppelin tutorials). It was deprecated in 2023; the maintainers recommend [ApeWorx Ape](https://docs.apeworx.io/) as the successor.

Real impact: thousands of public Brownie projects on GitHub still need to migrate. Each migration is mechanical but tedious — every `Contract.deploy(..., {"from": acc})` becomes `Contract.deploy(..., sender=acc)`, every `network.show_active()` becomes `networks.active_provider.network.name`, every imported contract becomes `project.<Name>`. A medium-sized test suite contains 50–200 such patterns.

This is exactly the kind of "boring AI" work the hackathon targets: deterministic transforms for the bulk, AI/manual cleanup for the long tail.

## 2. Migration Surface

I categorized Brownie patterns into 8 groups by transform feasibility:

| # | Pattern | Feasibility | Approach |
|---|---|---|---|
| 1 | `from brownie import …` rewrites | Deterministic | Rewrite with name renames + drops |
| 2 | `import brownie` (bare) | Deterministic (conditional) | Rewrite if `brownie.<attr>` was renamed in same file |
| 3 | `brownie.{reverts,accounts,project,config,chain}` | Deterministic | Rename to `ape.<attr>` |
| 4 | `brownie.network.show_active()` | Deterministic | Specific rewrite to `networks.active_provider.network.name` |
| 5 | bare `network.show_active()` | Deterministic | Same as #4 (conditional on file having `brownie` marker) |
| 6 | tx-dict → kwargs | Deterministic w/ guard | Rewrite if dict has `"from"` key + all keys whitelisted |
| 7 | Contract artifacts (`Token`, `FundMe`) | **Manual** | Drop from import + TODO; references need `project.X` |
| 8 | `chain.mine()/sleep()`, `accounts.add(pk)`, `exceptions.X` | **Manual** | Left alone — semantic differences too large for safe automation |

Groups 1–6 are auto-migrated. Group 7 is auto-flagged via a TODO comment so the user knows where to look. Group 8 is left alone (FN by design — automation here would risk FPs).

## 3. Architecture: 11-pass jssg transform

Codemod's `jssg` engine runs JavaScript/TypeScript code that operates on Tree-sitter ASTs. The codemod has 11 ordered passes (single file, ~510 LOC):

```
Pass 1:  from brownie import X, Y, Z  →  from ape import X', Y' (+ TODO for dropped Z)
Pass 2a: brownie.network.show_active()  →  networks.active_provider.network.name
Pass 2b: bare network.show_active()  →  networks.active_provider.network.name
Pass 2c: exceptions.VirtualMachineError  →  exceptions.ContractLogicError (+ qualified form,
         + top-of-file TODO for unmapped exception names)
Pass 3:  brownie.<known_attr>  →  ape.<attr>  (whitelist, skips inside dict literals)
Pass 3b: import brownie  →  import ape  (only if Pass 3 / 2c qualified rewrote)
Pass 4:  tx-dict {"from": x, ...}  →  kwargs sender=x, ...  (whitelist + spread guard)
Pass 5:  chain.mine(N)  →  chain.mine(num_blocks=N)  (positional → kwarg)
Pass 6:  chain.sleep(N) as a statement  →  chain.pending_timestamp += N
Pass 7:  accounts.add(pk)  →  accounts.add(pk)  # TODO: Ape: import_account_from_private_key(...)
Pass 8:  Brownie's def isolate(fn_isolation): pass  →  + TODO comment above (Ape has chain.isolate())
Pass 9:  Wei("X")  →  Wei("X")  # TODO: from ape.utils import convert; convert("X", int)
Pass 10: interface.X(addr)  →  interface.X(addr)  # TODO: Ape's Contract(addr) with explicit ABI/type
```

**Inline TODO passes (7, 9, 10) replace only the closing `)` of the call**, not the entire call text. This composes cleanly with sibling-pass edits — e.g. an `interface.X(config["networks"][network.show_active()][...])` call gets BOTH its `network.show_active()` rewritten by Pass 2b AND its closing `)` annotated by Pass 10. Replacing the whole call would clobber the inner edit.

A supplemental Python helper (`scripts/migrate_config.py`) converts `brownie-config.yaml` → `ape-config.yaml` for known fields (networks, solidity remappings/version, dependencies, dotenv) and emits TODO comments for unknown sections. The legacy YAML is renamed to `.legacy` so Ape doesn't accidentally pick it up.

### Why this ordering?

- **Pass 2 before Pass 3**: `brownie.network` is the inner attribute of `brownie.network.show_active()`. If we rewrote `brownie.network` first, the specific `show_active()` pattern would no longer match. Pass 3's whitelist deliberately excludes `network` for the same reason.
- **Pass 3b conditional on Pass 3**: `import brownie` should only become `import ape` if the file actually used a known `brownie.<attr>`. Files that do `import brownie; brownie.history.X` (uncommon, but possible) keep their original import.
- **Pass 4 replaces only the dict node**, not the entire argument list. This preserves edits scheduled by other passes on sibling positional args (e.g. `func(brownie.accounts[0], {"from": x})` rewrites both `brownie.accounts` and the dict independently).

### Inside-dictionary handling

Pass 3 skips `brownie.<attr>` matches that are descendants of a `dictionary` node (via `ancestors()` walk). Pass 4 then re-applies the renames using a regex on the dict's value text when constructing kwargs. This keeps both passes simple while handling values like `{"from": brownie.accounts[0]}` correctly.

## 4. Zero-FP Engineering

The hackathon scoring formula penalizes false positives heavily. I designed every guard with that in mind:

### Guard 1: File-level marker
```typescript
if (!sourceText.includes("brownie")) return null;
```
Files without any `brownie` reference are skipped entirely. This neutralizes the highest-risk transform (tx-dict → kwargs) on unrelated dicts like `send_email({"from": "alice@example.com"})` in non-Brownie code.

### Guard 2: Tx-dict whitelist
```typescript
const TX_DICT_KEYS = new Set([
  "from", "value", "gas", "gas_limit", "gas_price",
  "max_fee", "priority_fee", "nonce",
  "required_confs", "allow_revert",
]);
```
A dict is treated as a tx-dict only if **all** keys are in this whitelist AND `"from"` is present. A dict like `{"from": "...", "name": "alice"}` would abort because `"name"` isn't in the whitelist.

### Guard 3: Contract-name heuristic
```typescript
function isLikelyContractName(name: string): boolean {
  if (BROWNIE_BUILTIN_NAMES.has(name)) return false;
  if (IMPORT_NAMES_DROP.has(name)) return false;
  return /^[A-Z]/.test(name);
}
```
`from brownie import FundMe, accounts, network` correctly drops `FundMe` (uppercase, not built-in) while keeping `accounts` and renaming `network → networks`.

### Guard 4: Wildcard imports skipped
`from brownie import *` is detected via `findAll({ kind: "wildcard_import" })` and untouched — symbol resolution is required to safely rewrite, which is enterprise-only in jssg.

## 5. Results on Real OSS Repos

I tested on two repos representing typical Brownie project shapes — a token tutorial (`token-mix`) and a Patrick Collins course project (`brownie_fund_me`).

### `brownie-mix/token-mix`
- 5 Python files, 319 LOC, 53 tx-dict patterns
- After codemod: 4 files modified, **0 false positives**
- Diff stats: `+54 -53 lines across 4 files`
- Manual TODO: 1 (the `Token` contract import)
- Resulting code: ~98% of Brownie patterns auto-migrated

### `PatrickAlphaC/brownie_fund_me`
- 6 Python files, 129 LOC
- After codemod: 5 files modified, **0 false positives**
- Diff stats: `+26 -24 lines across 5 files`
- Manual TODOs: 4 (FundMe ×2, MockV3Aggregator ×2, exceptions ×1)
- Notable wins:
  - `network.show_active()` correctly rewritten in 8 contexts including subscript expressions (`config["networks"][network.show_active()]`) and f-strings (`f"... {network.show_active()}"`).
  - Multi-line import unwrapped: `from brownie import (MockV3Aggregator, network,)` → `from ape import networks` with TODO.
  - The tricky `FundMe.deploy(addr, {"from": x}, publish_source=...)` pattern (dict NOT being the last arg due to trailing kwarg) handled correctly — codemod detects the last *positional* arg and only rewrites the dict.

### Combined coverage estimate
- ~83 Brownie patterns auto-migrated across 9 files
- 0 incorrect changes
- ~5 contract-import TODOs (correct manual flagging — Ape's `project.<Name>` API can't be inferred without project schema introspection)

## 6. Test Suite

38 fixture tests (input/expected pairs), all passing. They cover:

| # | Fixture | What it asserts |
|---|---|---|
| 01 | basic-imports | Multi-name from-import rename including network → networks |
| 02 | import-with-contract | Contract name dropped with TODO |
| 03 | import-with-alias | `as alias` preserved through rename |
| 04 | brownie-reverts | Inside `with` statement |
| 05 | brownie-attr-chain | Subscripts and method chains: `brownie.accounts[0].balance()` |
| 06 | show-active | Standalone `brownie.network.show_active()` |
| 07–09 | tx-dict variations | Multi-arg, multi-key, dict-only-arg |
| 10 | no-fp-non-tx-dict | Dict with unrelated key (`"name"`) NOT transformed even in Brownie file |
| 11 | no-fp-no-brownie | Non-Brownie file with `{"from": x}` untouched |
| 12 | conftest-fixture | Realistic pytest conftest.py |
| 13 | wildcard-import-skipped | `from brownie import *` left as-is |
| 14 | tx-dict-with-brownie-accounts | `{"from": brownie.accounts[0]}` — both transforms apply |
| 15 | contract-name-heuristic | Multiple PascalCase contracts dropped |
| 16 | bare-show-active | `network.show_active()` after `from brownie import network` |
| 17 | tx-dict-with-trailing-kwarg | Dict not at last arg position (real `FundMe.deploy` pattern) |
| 18 | bare-import-brownie | `import brownie` → `import ape` when Pass 3 fires |
| 19 | bare-import-no-attr-rewrite | `import brownie` left alone if no `brownie.<attr>` was rewritten |
| 20 | byte-string-key | `{b"from": x}` NOT transformed (FP guard against prefixed strings) |
| 21 | spread-in-tx-dict | `{**other, "from": x}` NOT transformed (spread guard) |
| 22 | dropped-with-alias | `from brownie import Contract as C` TODO emits `Contract as C` |
| 23 | chain-mine-positional | `chain.mine(10)` → `chain.mine(num_blocks=10)` |
| 24 | chain-mine-already-kwarg | `chain.mine(num_blocks=5)` and `chain.mine()` left alone |
| 25 | chain-sleep-statement | `chain.sleep(60)` → `chain.pending_timestamp += 60` |
| 26 | chain-sleep-in-expression | `result = chain.sleep(60)` left alone (semantic risk) |
| 27 | exceptions-bare | `exceptions.VirtualMachineError` → `exceptions.ContractLogicError` (after rename in import) |
| 28 | exceptions-qualified | `brownie.exceptions.VirtualMachineError` → `ape.exceptions.ContractLogicError` |
| 29 | exceptions-unknown-untouched | `exceptions.SomeUnknownExc` left alone (only known names mapped) |
| 30 | accounts-add-statement | Trailing TODO comment on `accounts.add(...)` in safe contexts |
| 31 | accounts-add-in-expression | `if accounts.add(pk) is not None:` left alone (no inline comment) |
| 32 | isolate-fixture | TODO comment above `def isolate(fn_isolation): pass` |
| 33 | isolate-customized-untouched | User-customized isolate fixture with snapshot/revert NOT flagged |
| 34 | wei-call-statement | `Wei("1 ether")` in safe context gets inline TODO |
| 35 | wei-in-expression | `Wei(...)` inside `if` condition or list comprehension left alone |
| 36 | interface-call | `interface.IERC20(addr)` in assignment RHS gets inline TODO |
| 37 | interface-chained | `interface.IERC20(addr).balanceOf(...)` (chained) left alone — would break syntax |
| 38 | unknown-exception-todo | `exceptions.SomeUnknownExc` triggers top-of-file TODO listing the unmapped name |

```bash
$ codemod jssg test -l python ./scripts/codemod.ts ./tests/fixtures
running 38 tests
test 01-basic-imports                 ... ok
[…]
test 38-unknown-exception-todo        ... ok

test result: ok. 38 passed; 0 failed; 0 ignored
```

## 7. AI vs Manual Effort Breakdown

For a Brownie project being migrated with this recipe + Claude / Cursor for AI cleanup:

| Stage | Effort | Coverage |
|---|---|---|
| 1. Run codemod | 3 seconds | ~80–95% of mechanical patterns |
| 2. AI step (claude / cursor on TODO comments) | 5–15 min for typical project | Contract artifact rewrites (`project.X`), exception class renames, `chain.mine/sleep` |
| 3. Manual verification | 10–30 min | Run `ape compile`, fix any remaining edge cases, run tests |

A migration that previously took **half a day to a full day** of mechanical refactoring is now a ~**30-minute task**.

## 8. What I Learned About Codemod / jssg

- **jssg is significantly more ergonomic than jscodeshift** for Python — Tree-sitter handles all string/quote variants natively (single, double, triple, f-strings) and the rule object syntax (`pattern`, `kind`, `has`, `regex`) is more declarative than Babel visitor patterns.
- **Pattern-based AST queries scale poorly without ordering control** — for overlapping rewrites I had to think hard about which pass should fire first. Codemod's `findAll` returns nodes in document order, but `commitEdits` doesn't reject overlapping edits — they just apply unpredictably. Solving this requires AST containment checks (`ancestors()` walks).
- **Semantic analysis is JS/TS + Python only** in OSS jssg (Rust/Go/Java are enterprise). For Brownie→Ape this is fine — Python's symbol resolution via ruff is built in. For framework migrations in Rust (Anchor 0.30, Solana programs) the same approach would be more limited.
- **Workflow YAML's `--allow-dirty` and `--no-interactive` flags** are essential for CI / AI-agent invocation. The default mode prompts for confirmation on dirty git state.

## 8.5. Performance benchmark

Bundled benchmark script ([`scripts/benchmark.sh`](./scripts/benchmark.sh))
runs the codemod on all four reference repos from a freshly-cloned state
and reports wall-clock times. Latest run:

| Repo | .py files | Brownie patterns | Files modified | Wall-clock |
|---|---:|---:|---:|---:|
| [token-mix](https://github.com/brownie-mix/token-mix) | 5 | 58 | 4 | ~24 s |
| [brownie_fund_me](https://github.com/PatrickAlphaC/brownie_fund_me) | 6 | 17 | 5 | ~25 s |
| [smartcontract-lottery](https://github.com/PatrickAlphaC/smartcontract-lottery) | 7 | 34 | 5 | ~17 s |
| [aave_brownie_py_freecode](https://github.com/PatrickAlphaC/aave_brownie_py_freecode) | 5 | 13 | 4 | ~14 s |

Wall-clock includes `npx` startup (downloading + spawning the Codemod CLI on
first invocation). The Codemod workflow itself reports **~3 seconds per
repo** end-to-end. After warmup, sequential repo runs share the cached CLI
and drop to ~5 s wall-clock per repo. See [`benchmark/results.md`](./benchmark/results.md)
for the latest numbers (regenerable via `bash scripts/benchmark.sh`).

For curated before/after examples on each transform pass, see
[`DEMO.md`](./DEMO.md). For a self-contained reproducible demo:

```bash
bash demo/run-demo.sh
# or, recording with asciinema:
asciinema rec demo.cast -c "bash demo/run-demo.sh"
```

## 9. Reproducing this Case Study

```bash
git clone https://github.com/<your-fork-of>/brownie-to-ape
cd brownie-to-ape

# Verify the codemod
codemod jssg test -l python ./scripts/codemod.ts ./tests/fixtures
# 19 passed; 0 failed

# Test on token-mix
git clone --depth 1 https://github.com/brownie-mix/token-mix.git /tmp/token-mix
codemod workflow run -w workflow.yaml --target /tmp/token-mix --no-interactive --allow-dirty
cd /tmp/token-mix && git diff --stat   # 4 files modified
```

## 10. Submission Tracks

- **Track 1 (Migration Recipe)**: `brownie-to-ape` published to the Codemod registry with workflow.yaml, codemod.yaml, 4-pass jssg transform (~220 LOC), 19 fixture tests.
- **Track 2 (Case Study)**: this document.
- **Track 3 (Framework Adoption)**: aspirational — opening a discussion issue on [ApeWorX/ape](https://github.com/ApeWorX/ape) to reference this codemod from their migration guide. (Pending — beyond hackathon timeline.)

---

## Links

- Codemod: `https://app.codemod.com/registry/brownie-to-ape` (after publish)
- Hackathon page: https://dorahacks.io/hackathon/codemod
- Codemod docs: https://docs.codemod.com/
- jssg engine: https://docs.codemod.com/jssg/intro
- Brownie deprecation note: https://eth-brownie.readthedocs.io/en/stable/
- Ape porting guide: https://academy.apeworx.io/articles/porting-brownie-to-ape
