# Migrating Brownie to ApeWorx Ape: How I Built a 0-False-Positive Codemod with 250 Tests and Verified `ape test` Passing on 5 Real OSS Repos

> Submitted to the Codemod "Boring AI" Hackathon (DoraHacks 2026).
> Source: [github.com/PugarHuda/brownie-to-ape](https://github.com/PugarHuda/brownie-to-ape)
> Registry: [`@pugarhuda/brownie-to-ape`](https://app.codemod.com/registry/@pugarhuda/brownie-to-ape)

> **Bahasa Indonesia version:** [README.id.md di repo](https://github.com/PugarHuda/brownie-to-ape/blob/main/README.id.md)

---

## TL;DR

Brownie was officially deprecated in 2023; ApeWorx Ape is the recommended successor. Migrating a real Brownie project means rewriting 50–200 mechanical patterns by hand: every `Contract.deploy(…, {"from": acct})` becomes `Contract.deploy(…, sender=acct)`, every `network.show_active()` becomes `networks.active_provider.network.name`, every `Wei("1 ether")` becomes `convert("1 ether", int)`, and so on.

I built `@pugarhuda/brownie-to-ape` — a codemod that automates 80–95% of this in ~3 seconds per repo, with **zero false positives** across **5 OSS Brownie projects** (including [yearn/brownie-strategy-mix](https://github.com/yearn/brownie-strategy-mix)). The final test, after running the codemod plus 6 small AI-step manual fixes (~30 LOC across 4 files) on `brownie-mix/token-mix`:

```
ape compile               → SUCCESS (solc 0.6.12, 2 contracts)
ape test --network ::test → 38 passed, 0 failed in 5.40s
```

The full passing log is committed in the repo at [`docs/ape-verify-token-mix.log`](https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/ape-verify-token-mix.log).

This post is a write-up of the design, the failure modes I learned from, and what made the difference between "looks correct in unit tests" and "actually compiles and runs on real Brownie code."

---

## The problem space: why Brownie → Ape is harder than it looks

Brownie was the dominant Python framework for Ethereum smart-contract development from ~2019 until its deprecation in 2023. Thousands of public GitHub repos, including major DeFi codebases like Yearn, still depend on it. Migrating to Ape isn't a simple find-and-replace because:

1. **Imports get rearranged.** `from brownie import accounts, network, chain` becomes `from ape import accounts, networks, chain` (note the `network` → `networks` rename — a single character that breaks every test if you miss it). Constants like `ZERO_ADDRESS` move to `ape.utils`.
2. **Transaction kwargs change shape.** `Contract.deploy(arg, {"from": x, "value": v})` becomes `Contract.deploy(arg, sender=x, value=v)`. The dict-of-strings form becomes positional kwargs, and `"from"` becomes `sender` (because `from` is a Python reserved word).
3. **Time/block control reverses.** `chain.sleep(60)` becomes `chain.pending_timestamp += 60`. `chain.mine(N)` becomes `chain.mine(num_blocks=N)`. Different mental model.
4. **Exception classes are renamed.** `exceptions.VirtualMachineError` is gone; the closest match is `exceptions.ContractLogicError`. But not every Brownie exception has a clean Ape equivalent.
5. **Test infrastructure differs.** Brownie's `def isolate(fn_isolation): pass` fixture is unnecessary in Ape (which provides `chain.isolate()` natively). Test event access is different too: `tx.events["Transfer"].values()` (Brownie) vs `list(tx.decode_logs(token.Transfer))` (Ape). And the `from` field of an event log can't be accessed as `log.from` because `from` is a keyword — you need `getattr(log, "from")`.
6. **Contract artifacts can't be inferred.** When Brownie code says `Token.deploy(...)`, the codemod cannot know which contract that refers to without project-schema introspection (which the jssg sandbox doesn't have access to). Ape requires `project.Token.deploy(...)`. This is a structural gap that no static codemod can close.

A codemod has to be conservative on (6), aggressive on (1)–(5), and careful around the boundaries.

---

## The design philosophy: prefer FN over FP

The hackathon's scoring formula is:

```
Score = 100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))
```

with `wFP > wFN`. False positives — incorrect changes — are penalized far more heavily than false negatives — missed patterns. This isn't arbitrary: a missed pattern shows up as a TODO comment that an AI agent or human can fix in seconds; an incorrect rewrite breaks production code silently.

So the design rule is: **when in doubt, don't fire**. Every transform pass has explicit guards. For example:

```typescript
// Pass 4: tx-dict → kwargs
// Whitelist: only fire when EVERY key in the dict is in the known
// transaction-dict key set. If we see {"from": x, "custom_field": y},
// we don't touch it — it might be a different kind of dict that just
// happens to contain "from".
const TX_DICT_KEYS = new Set(["from", "value", "gas_limit", "gas_price",
                              "gas_buffer", "max_fee", "max_priority_fee",
                              "nonce", "chainid", "required_confirmations"]);

if (!keys.every(k => TX_DICT_KEYS.has(k))) {
  return; // skip — could be a non-tx dict
}
if (!keys.includes("from")) {
  return; // skip — no "from" means it's not a deploy/call dict
}
```

The codemod ships **17 transform passes** with guards like this. Plus a file-level early-exit: if `sourceText.includes("brownie")` is false, the file is skipped entirely. (This is what caused one of the AI-step fixes on `token-mix`: the test file `test_approve.py` had no `import brownie` line — it received `accounts` and `token` as fixture parameters from `conftest.py` — so the file-level guard skipped it. A blind regex tool would have rewritten the `{"from": ...}` dicts in that file and possibly broken something. Our codemod left them alone and surfaced them as a manual TODO. That's the FP-vs-FN tradeoff working as intended.)

---

## What gets automated (deterministic, 0 FP)

| # | Pattern | Before | After |
|---|---|---|---|
| 1 | Import rename | `from brownie import accounts, network` | `from ape import accounts, networks` |
| 2 | Constants relocate | `from brownie import ZERO_ADDRESS` | `from ape.utils import ZERO_ADDRESS` |
| 3 | Attribute access | `brownie.chain.id` | `ape.chain.id` |
| 4 | tx-dict → kwargs | `Token.deploy({"from": acct, "value": 1e18})` | `Token.deploy(sender=acct, value=1e18)` |
| 5 | Network introspection | `network.show_active()` | `networks.active_provider.network.name` |
| 6 | Block mining | `chain.mine(5)` | `chain.mine(num_blocks=5)` |
| 7 | Time advance | `chain.sleep(60)` (statement) | `chain.pending_timestamp += 60` |
| 8 | Wei conversion | `Wei("1 ether")` | `convert("1 ether", int)` (with auto-import) |
| 9 | Exception rename | `exceptions.VirtualMachineError` | `exceptions.ContractLogicError` |
| 10 | `accounts.add(pk)` | inline TODO + recommended Ape pattern |
| 11 | `interface.IERC20(addr)` | inline TODO + Ape pattern `Contract(addr)` |
| 12 | `Web3.toWei` / `fromWei` | inline TODO for migration to `convert(...)` |
| 13 | Brownie's `isolate(fn_isolation)` fixture | TODO: drop, Ape has `chain.isolate()` natively |
| 14 | `accounts.at(addr, force=True)` | `accounts.impersonate_account(addr)` (whale impersonation) |
| 15 | Contract artifact rewrite (safe shapes only) | `Token` → `project.Token` for known patterns |
| 16 | `chain.id` ↔ `networks.provider.chain_id` | bidirectional |
| 17 | Fixup pass | residual `brownie` references → top-of-file TODO |

---

## What I learned testing on real OSS code

The 90 fixture tests in the test suite are synthetic — small Python files designed to exercise specific transform passes. They prove the transform works on the patterns I anticipated. But they don't prove the transform works on actual Brownie code, which has shape combinations I didn't anticipate.

So I validated the codemod on five real OSS Brownie projects:

| Repo | Files modified | Patterns auto-migrated | FP | TODOs (manual) |
|---|---|---|---|---|
| [`brownie-mix/token-mix`](https://github.com/brownie-mix/token-mix) | 4/5 .py | ~62 | 0 | 1 contract + 1 isolate |
| [`PatrickAlphaC/brownie_fund_me`](https://github.com/PatrickAlphaC/brownie_fund_me) | 5/6 .py | ~21 | 0 | 4 contract + 1 accounts.add |
| [`PatrickAlphaC/smartcontract-lottery`](https://github.com/PatrickAlphaC/smartcontract-lottery) | 5/7 .py | ~30 | 0 | 5 contract + 1 isolate |
| [`PatrickAlphaC/aave_brownie_py_freecode`](https://github.com/PatrickAlphaC/aave_brownie_py_freecode) | 4/5 .py | ~24 | 0 | 1 interface drop + 5 inline interface TODOs |
| [`yearn/brownie-strategy-mix`](https://github.com/yearn/brownie-strategy-mix) ⭐ | 4/7 .py | ~33 | 0 | 4 contract + web3 preserve |
| **Combined** | **22 / 30 (73%)** | **~170** | **0** | **~22** |

Every TODO is intentional. They map to the structural gap from problem (6) above — contract artifacts the codemod can't infer without project-schema introspection — plus a handful of patterns that require more context than a static AST transform can supply.

---

## The end-to-end proof: `ape compile && ape test` on token-mix

The hackathon's evaluation pipeline is explicit: "Codemod runs ✅ → AI handles edge cases ✅ → Manual fixes until build and tests pass ✅". I wanted to actually walk through all three on a real repo and capture a passing log, not just claim it would work.

Steps:

1. Reset `brownie-mix/token-mix` to clean Brownie state.
2. Apply the codemod: `npx codemod@latest workflow run -w workflow.yaml --target /path/to/token-mix --no-interactive --allow-dirty`. Result: 4 files modified, 54 edits in 3 seconds.
3. Run `python scripts/migrate_config.py /path/to/token-mix` to translate `brownie-config.yaml` → `ape-config.yaml`.
4. Apply 6 AI-step manual fixes (~30 LOC across 4 files):
   - Add `project.Token.deploy(...)` prefix in `scripts/token.py` (codemod TODO #1).
   - Drop the `isolate(fn_isolation)` fixture (codemod TODO #2).
   - Cast `1e21` → `int(1e21)` — Ape rejects float scientific notation with `ConversionError`.
   - Convert `{'from': X}` → `sender=X` in `test_approve.py` (file had no `import brownie` so codemod's FP-guard skipped it — exactly the kind of "AI handles edge cases" gap the hackathon expects).
   - Replace `tx.return_value is True` assertions with state assertions via `balanceOf` / `allowance` (Ape doesn't expose tx returns for non-view functions).
   - Replace `tx.events["X"].values()` with `list(tx.decode_logs(token.X))` — and use `getattr(log, "from")` for the reserved-keyword field.
5. `ape compile` → SUCCESS (solc 0.6.12, both contracts).
6. `ape test --network ::test` → **38 passed, 0 failed in 5.40s**.

Full passing pytest log: [`docs/ape-verify-token-mix.log`](https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/ape-verify-token-mix.log) (80 lines, committed).
Step-by-step AI-fix walkthrough: [`demo/ai-step-demo.md`](https://github.com/PugarHuda/brownie-to-ape/blob/main/demo/ai-step-demo.md).

---

## Test depth: why 250 tests is the right number

The test suite covers three distinct layers:

- **90 fixture tests (jssg snapshots).** Each fixture is an `input.py` and `expected.py` pair. The jssg test runner runs the codemod on `input.py` and diffs the output against `expected.py`. This is *specification testing* — the fixtures are the spec for the codemod's behavior. 15+ of the 90 are explicit negative cases (proving the codemod does *not* fire on lambda, list comprehension, walrus, async/await, OrderedDict, helper functions, malformed Python, etc.) — those are the FP-prevention tests.

- **125 Vitest tests.**
  - 50 pure-function unit tests on the helper logic (extracted into a standalone `_helpers.ts` so they're testable outside the jssg sandbox)
  - 11 property tests for idempotency and determinism (run the codemod twice on the same input — output must be identical; reorder unrelated patterns — output must be identical)
  - 53 QA tests covering version consistency, docs integrity, performance budget, and golden-master regression
  - 11 idempotency-specific tests (6 are gated behind `VITEST_RUN_PROPERTY=1` for slow runs)

- **35 pytest tests** for the YAML config translator (`migrate_config.py`):
  - 16 Describe* class-based tests
  - 13 legacy `unittest.TestCase` tests
  - **6 Hypothesis property-based fuzz tests** that generate arbitrary YAML-shaped inputs and assert the translator never crashes, always returns `(dict, list_of_str)`, and produces idempotent output

Plus a Stryker mutation-testing baseline (38.57%) on the critical helpers. The mutation score has an architectural ceiling — the jssg sandbox prevents importing the helpers as a separate module — and that ceiling is documented honestly in [`docs/DEFERRED_FEATURES.md`](https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/DEFERRED_FEATURES.md).

---

## What's NOT in the codemod (and why)

I deliberately don't auto-rewrite a few patterns even though they look automatable. The reasoning is documented in [`docs/DEFERRED_FEATURES.md`](https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/DEFERRED_FEATURES.md). Highlights:

- **`accounts.add(private_key)` is not auto-rewritten.** The Ape equivalent is `accounts.import_account_from_private_key(alias, passphrase, private_key)` — but `alias` and `passphrase` don't exist in the Brownie call. We can't invent them. A blind rewrite would produce code that doesn't run.
- **`interface.IERC20(addr)` is not auto-rewritten to `Contract(addr)`.** It might be correct, but it requires the user's project to have an ABI registered for that interface. The jssg sandbox can't introspect project state to confirm.
- **No browser WASM playground.** Codemod's `jssg` engine compiles its ast-grep + tree-sitter stack into a sandboxed Node runtime. Bundling those native components for the browser would require a custom WASM build of `tree-sitter-python` + an `ast-grep-wasm` glue layer — neither officially shipped. Effort vs benefit: ~8+ hours for what the asciinema cast on the [live demo](https://pugarhuda.github.io/brownie-to-ape/) already provides.
- **No pre-commit hook integration.** Brownie is deprecated. New projects don't start in Brownie. A pre-commit hook is the wrong abstraction for "one-time migration."

Each "no" is a deliberate choice to preserve the 0 FP guarantee. The hackathon's scoring formula penalizes FP at `wFP > wFN`, so an accidentally-broken `accounts.add` call in a real codebase outweighs every FN we could save by attempting auto-rewrite.

---

## Try it yourself

```bash
# Run from registry (~3 seconds after npx warmup)
git clone --depth 1 https://github.com/brownie-mix/token-mix.git /tmp/token-mix
npx codemod@latest @pugarhuda/brownie-to-ape -t /tmp/token-mix
cd /tmp/token-mix && git diff --stat
# Expected: 4 files changed, ~62 patterns rewritten, 0 incorrect changes
```

Or run the full repo test suite:

```bash
git clone https://github.com/PugarHuda/brownie-to-ape && cd brownie-to-ape
npm test                  # 90 jssg fixture tests
npm run test:unit         # 125 Vitest tests
npm run test:python       # 35 pytest tests (incl. Hypothesis fuzzer)
```

To reproduce the end-to-end `ape test` 38/38 PASS:

```bash
# Apply codemod + AI-step fixes per demo/ai-step-demo.md
pip install eth-ape
ape plugins install solidity --yes
cd /tmp/token-mix
ape compile           # → SUCCESS, solc 0.6.12, 2 contracts
ape test --network ::test  # → 38 passed, 0 failed in 5.40s
```

---

## Key design decisions, in one paragraph each

**Engine: true jssg / ast-grep, not regex.** Every transform pass operates on the Tree-sitter Python AST via `findAll(...)` / `field(...)` / `kind(...)` / `parent(...)` calls. No `source.replace(...)` over text. This matters because regex over Python source can't distinguish `{"from": ...}` in a tx-deploy call from `{"from": ...}` as a literal in some unrelated dict.

**Pass ordering.** Specific patterns run before generic ones. For example, `brownie.network.show_active()` (Pass 2a) is rewritten to `networks.active_provider.network.name` *before* the generic `brownie.<attr>` → `ape.<attr>` rewrite (Pass 3) fires, so the network call doesn't get partially rewritten then re-rewritten. AST containment checks (`isInsideDictionary()`) prevent overlapping edits.

**FP guards are explicit, not heuristic.** Every transform has a named guard. The tx-dict pass has a whitelist of valid keys plus a `from` requirement. The contract-artifact heuristic has a name pattern (`/^[A-Z][a-zA-Z0-9]*$/` with a deny-list). The exception rewrite has a known-class allow-list and emits a top-of-file TODO listing unknown classes for the user.

**Negative tests > positive tests.** 15+ of the 90 fixtures exist explicitly to prove the codemod *doesn't* fire on FP-risk patterns: lambda parameters named `from`, list comprehensions over dicts, walrus operator usage, async/await, OrderedDict, helper functions, malformed Python, brownie-only-in-string-literal, dict-spread, etc. Every one of these caught a real bug during development.

**TODO comments are AI-friendly.** When the codemod can't safely rewrite something, it emits a comment with a specific, actionable instruction. "no direct Ape equivalent for: Token" tells the AI agent to look up `project.Token.deploy(...)`. "Ape has built-in per-test chain isolation via chain.isolate(). This fixture can be removed." tells it exactly what to do. The comments are short enough to be read at-a-glance and specific enough that a Claude/Cursor/Copilot-class AI applies the right fix.

---

## Open questions and what I'd build next

If I had another week:

1. **Ship a Brownie → Ape testing runtime shim.** A small `pytest_brownie_compat.py` plugin that maps Brownie test idioms (`tx.return_value`, `tx.events["X"].values()`) onto Ape semantics, so existing test suites pass without manual rewriting. This would close the 6 AI-step fixes I had to apply on token-mix.
2. **Validate on more repos.** I have 5 in the case study; expanding to 10–20 would strengthen the "works on real codebases" claim. The next candidates are projects in the `brownie-mix` org and DeFi protocol forks.
3. **Pre-commit hook for Brownie users planning to migrate.** Not as a continuous prevention tool, but as a "estimate the migration before you commit to it" diff preview.
4. **Improve mutation-testing score.** The 38.57% baseline has an architectural ceiling because the jssg sandbox can't import standalone helper modules. A future version could ship two parallel implementations — the inline one for jssg, the modular one for Stryker — and prove they stay in sync via cross-validation.

---

## Acknowledgements

- The [Codemod team](https://codemod.com/) for the jssg engine and the hackathon framing — making maintenance "boring" is the right framing.
- [ApeWorx](https://apeworx.io/) for the Ape framework itself, the migration documentation, and being responsive to GitHub issues.
- The maintainers of `brownie-mix/token-mix`, `PatrickAlphaC/brownie_fund_me`, `PatrickAlphaC/smartcontract-lottery`, `PatrickAlphaC/aave_brownie_py_freecode`, and `yearn/brownie-strategy-mix` — your public repos made the validation testing possible.
- [Anthropic Claude](https://claude.com/) for collaborative authoring of test fixtures, AST exploration, and this article.

---

**Source:** [github.com/PugarHuda/brownie-to-ape](https://github.com/PugarHuda/brownie-to-ape) · v0.7.7 · MIT
**Codemod registry:** [`@pugarhuda/brownie-to-ape`](https://app.codemod.com/registry/@pugarhuda/brownie-to-ape)
**Live demo:** https://pugarhuda.github.io/brownie-to-ape/
**Bahasa Indonesia:** [README.id.md](https://github.com/PugarHuda/brownie-to-ape/blob/main/README.id.md)
**Hackathon:** [Codemod Boring AI · DoraHacks 2026](https://dorahacks.io/hackathon/codemod)
