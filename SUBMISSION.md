# DoraHacks BUIDL Submission — @pugarhuda/brownie-to-ape

Pre-filled form fields untuk submit ke https://dorahacks.io/hackathon/codemod/buidl/new

---

## Project Name
`@pugarhuda/brownie-to-ape`

## Tagline / Short Description (≤140 chars)
> Automated Brownie → ApeWorx Ape migration codemod. 17-pass jssg transform, **238 tests** (84 fixture + 125 Vitest + 29 pytest), validated on **5 OSS repos (incl. Yearn Finance) with zero false positives**. Live demo: pugarhuda.github.io/brownie-to-ape

## Category Tags
- AI-assisted coding
- Code migrations
- Automated coding
- Codemod
- Python
- Smart contracts

## Tracks Targeted
- ✅ **Track 1: Production Migration Recipe** (Size: M, target $200) — published at v0.7.6
- ✅ **Track 2: Public Case Study** (target $200) — `CASE_STUDY.md` + `DEMO.md` + asciinema cast
- ✅ **Track 3: Framework Adoption** — issue [#2774](https://github.com/ApeWorX/ape/issues/2774) opened at ApeWorX/ape (target up to $2,000)

## Full Description

Brownie was deprecated in 2023; ApeWorX Ape is the recommended successor. Thousands of public Python smart-contract projects on GitHub still need to migrate, with each migration involving 50-200 mechanical pattern rewrites that take a half-day to a full day manually.

`@pugarhuda/brownie-to-ape` automates 80-95% of this work in **~3 seconds per repo** with **zero false positives**. The remaining 5-20% (mostly contract artifact references that require project schema introspection) is auto-flagged with `# TODO(brownie-to-ape):` comments for AI cleanup or manual review.

### Built with
- Codemod CLI + `jssg` engine (NOT jscodeshift — explicitly disallowed by hackathon rules)
- ast-grep on Tree-sitter Python grammar
- TypeScript transform code (~685 LOC, 12 ordered passes)
- Python helper for YAML config migration (`brownie-config.yaml` → `ape-config.yaml`)

### What it migrates (auto-deterministic, 0 FP)
1. `from brownie import …` → `from ape import …` with name renames (`network` → `networks`), constants moved to `from ape.utils import …` (`ZERO_ADDRESS`), and contract artifacts dropped with TODO
2. `import brownie` → `import ape` (when `brownie.<attr>` was rewritten)
3. `brownie.{reverts,accounts,project,config,chain}` → `ape.<attr>`
4. `brownie.network.show_active()` and bare `network.show_active()` → `networks.active_provider.network.name`
5. tx-dict → kwargs: `Contract.deploy(arg, {"from": x, "value": v})` → `Contract.deploy(arg, sender=x, value=v)`. Handles trailing kwargs, multi-line, single & double & mixed quotes, trailing commas.
6. `chain.mine(N)` → `chain.mine(num_blocks=N)`
7. `chain.sleep(N)` (statement) → `chain.pending_timestamp += N`
8. `Wei("X")` → `convert("X", int)` with auto-injection of `from ape.utils import convert`
9. Exceptions: `exceptions.VirtualMachineError` → `exceptions.ContractLogicError` (and other known names; unknown names get a top-of-file TODO listing them)
10. Inline TODO for `accounts.add(pk)` flagging `accounts.import_account_from_private_key(...)`
11. Inline TODO for `interface.IERC20(addr)` flagging Ape's `Contract(addr)` pattern
12. Inline TODO for `Web3.toWei(...)` / `Web3.fromWei(...)` (web3.py-adjacent, common in Brownie projects)
13. Detection of Brownie's `def isolate(fn_isolation): pass` fixture with TODO note that Ape provides `chain.isolate()` natively (only fires on trivial bodies — user-customized fixtures left alone)

### Validated on five real OSS Brownie projects (all zero FP)

| Repo | Files modified | Patterns auto-migrated |
|---|---|---|
| brownie-mix/token-mix | 4 / 5 .py | ~62 |
| PatrickAlphaC/brownie_fund_me | 5 / 6 .py | ~21 |
| PatrickAlphaC/smartcontract-lottery | 5 / 7 .py | ~30 |
| PatrickAlphaC/aave_brownie_py_freecode | 4 / 5 .py | ~24 |
| yearn/brownie-strategy-mix ⭐ | 4 / 7 .py | ~33 |
| **Combined** | **22 / 30 (73%)** | **~170** |

### Test suite
- **61 fixture tests** (jssg `input.py` + `expected.py` pairs) — 15 of those are negative tests proving the codemod does NOT fire in FP-risk contexts (lambda, list comprehension, walrus, async/await, OrderedDict, helper functions, malformed Python, brownie-only-in-string, dict-spread, etc.)
- **13 Python unit tests** for the YAML config translator
- **CI on every push** ([test.yml](https://github.com/PugarHuda/brownie-to-ape/blob/main/.github/workflows/test.yml)), passing badge live in README

```
$ npx codemod@latest jssg test -l python ./scripts/codemod.ts ./tests/fixtures
test result: ok. 55 passed; 0 failed; 0 ignored

$ python -m unittest tests.test_migrate_config -v
Ran 13 tests in 0.001s. OK
```

## Links
- **GitHub repo:** https://github.com/PugarHuda/brownie-to-ape
- **Codemod registry:** https://app.codemod.com/registry/@pugarhuda/brownie-to-ape (live at v0.7.6)
- **Case Study:** https://github.com/PugarHuda/brownie-to-ape/blob/main/CASE_STUDY.md
- **Demo (curated diffs):** https://github.com/PugarHuda/brownie-to-ape/blob/main/DEMO.md
- **Asciinema cast:** https://github.com/PugarHuda/brownie-to-ape/blob/main/demo/demo.cast
- **Track 3 issue at ApeWorX/ape:** https://github.com/ApeWorX/ape/issues/2774
- **Latest release:** https://github.com/PugarHuda/brownie-to-ape/releases/tag/v0.7.6

## How to test (for evaluators)

```bash
# 1. Run from registry (~3 seconds after npx warmup)
git clone --depth 1 https://github.com/brownie-mix/token-mix.git /tmp/token-mix
npx codemod@latest @pugarhuda/brownie-to-ape -t /tmp/token-mix
cd /tmp/token-mix && git diff --stat
# Expected: 4 files changed, ~55 insertions, 0 incorrect changes

# 2. Or clone repo and run unit tests
git clone https://github.com/PugarHuda/brownie-to-ape && cd brownie-to-ape
npm test
# Expected: 55 passed; 0 failed
python -m unittest tests.test_migrate_config -v
# Expected: Ran 13 tests in 0.001s. OK

# 3. Reproduce the benchmark
bash scripts/benchmark.sh
# Auto-clones 4 reference repos, times the codemod, outputs benchmark/results.md
```

## Coverage / Scoring breakdown

Following the hackathon scoring formula `100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))`:

- **token-mix:** ~62 patterns total, 0 FP, 1 contract-related FN → high score
- **brownie_fund_me:** ~21 patterns total, 0 FP, 4 contract/exception FNs → high score
- **smartcontract-lottery:** ~30 patterns, 0 FP, 5 contract/interface FNs → high score
- **aave:** ~24 patterns, 0 FP, 5 interface FNs → high score

All FNs are intentional (contract artifacts can't be inferred without project schema introspection). They're auto-flagged with `# TODO(brownie-to-ape):` comments for AI/manual cleanup.

## Author
**Pugar Huda Mantoro**
- Email: pugarhudam@gmail.com
- GitHub: [@PugarHuda](https://github.com/PugarHuda)

---

## Pre-publish checklist (status)

- [x] All 61 fixture tests passing
- [x] All 13 Python unit tests passing
- [x] Workflow YAML validated
- [x] Tested on 4 real OSS repos with 0 FP
- [x] README, CASE_STUDY, DEMO, FAQ, Troubleshooting complete
- [x] CI workflows live (test passing, publish on tag)
- [x] **Published to Codemod registry as `@pugarhuda/brownie-to-ape@0.7.4`** ⭐
- [x] **Track 3 issue opened at ApeWorX/ape#2774** ⭐
- [x] LICENSE, SECURITY, CHANGELOG, CONTRIBUTING all present
- [ ] Submit BUIDL on DoraHacks (this form ⬅)
- [ ] (Optional) Upload asciinema demo cast for shareable URL
