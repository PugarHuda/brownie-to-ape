# DoraHacks BUIDL Submission — @pugarhuda/brownie-to-ape

Pre-filled form fields untuk submit ke https://dorahacks.io/hackathon/codemod/buidl/new

---

## Project Name
`@pugarhuda/brownie-to-ape`

## Tagline / Short Description (≤140 chars)
> Automated Brownie → ApeWorx Ape migration codemod. 17-pass jssg transform, **250 tests** (90 fixture + 125 Vitest + 35 pytest), validated on **5 OSS repos (incl. Yearn Finance) with zero false positives**. Live demo: pugarhuda.github.io/brownie-to-ape

## Category Tags
- AI-assisted coding
- Code migrations
- Automated coding
- Codemod
- Python
- Smart contracts

## Tracks Targeted
- ✅ **Track 1: Production Migration Recipe** (Size: L, target $400) — published at v0.7.9 — 17 transform passes, 250 tests, 5 OSS repos validated incl. Yearn Finance, end-to-end `ape test` 38/38 PASS
- ✅ **Track 2: Public Case Study** (3 published, target $600) — see "Published Case Studies" links below
- ✅ **Track 3: Framework Adoption** — **7 ecosystem PRs** filed (target up to $2,000):
  - **eth-brownie/brownie PR [#2145](https://github.com/eth-brownie/brownie/pull/2145)** — upstream source repo migration tooling section ⭐
  - ApeWorX/ape PR [#2780](https://github.com/ApeWorX/ape/pull/2780) + issue [#2774](https://github.com/ApeWorX/ape/issues/2774) — official Brownie migration guide
  - **ApeWorX/skills PR [#9](https://github.com/ApeWorX/skills/pull/9)** — new `migrate-from-brownie` skill for Claude/LLMs ⭐
  - codemod-com/codemod PR [#2168](https://github.com/codemod-com/codemod/pull/2168) — Codemod platform docs
  - **bkrem/awesome-solidity PR [#173](https://github.com/bkrem/awesome-solidity/pull/173)** — Brownie entry annotation in 7k⭐ list ⭐
  - rajasegar/awesome-codemods PR [#7](https://github.com/rajasegar/awesome-codemods/pull/7) — awesome list inclusion
  - Kludex/awesome-python-codemods PR [#1](https://github.com/Kludex/awesome-python-codemods/pull/1) — Python-specific awesome list

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
- **90 fixture tests** (jssg `input.py` + `expected.py` pairs) — 15+ are negative tests proving the codemod does NOT fire in FP-risk contexts (lambda, list comprehension, walrus, async/await, OrderedDict, helper functions, malformed Python, brownie-only-in-string, dict-spread, etc.)
- **125 Vitest tests** for pure helpers, property invariants, and QA (version consistency, docs integrity, perf budget, golden-master)
- **35 pytest tests** for the YAML config translator (16 Describe* + 13 legacy `TestCase` + **6 Hypothesis property-based fuzz tests**)
- **CI on every push** ([test.yml](https://github.com/PugarHuda/brownie-to-ape/blob/main/.github/workflows/test.yml)), green badge live in README

```
$ npm test
test result: ok. 90 passed; 0 failed; 0 ignored

$ python -m unittest tests.test_migrate_config -v
Ran 13 tests in 0.001s. OK
```

## Links

### Code & Registry
- **GitHub repo:** https://github.com/PugarHuda/brownie-to-ape
- **Codemod registry:** https://app.codemod.com/registry/@pugarhuda/brownie-to-ape (live at v0.7.9)
- **Live demo:** https://pugarhuda.github.io/brownie-to-ape/
- **Latest release:** https://github.com/PugarHuda/brownie-to-ape/releases/tag/v0.7.9

### Published Case Studies (Track 2)
- 📝 **Medium — End-to-end token-mix migration with `ape test` 38/38 PASS:** https://medium.com/@hudapugar/migrating-brownie-to-apeworx-ape-how-i-built-a-0-false-positive-codemod-with-250-tests-and-661f97e065e1
- 📝 **Medium — Engineering tradeoffs: why we said NO to 5 features:** https://medium.com/@hudapugar/engineering-tradeoffs-why-we-said-no-to-features-in-a-hackathon-codemod-19e2de92897b
- 📝 **dev.to — Yearn Finance DeFi-specific migration walkthrough:** https://dev.to/hudapugar/migrating-yearn-finances-strategy-template-from-brownie-to-apeworx-ape-a-defi-specific-case-study-4m57

### Framework Adoption (Track 3) — 7 ecosystem PRs filed
- **eth-brownie/brownie PR #2145 (filed 2026-05-03):** https://github.com/eth-brownie/brownie/pull/2145 ⭐ — upstream source repo migration tooling section
- **ApeWorX/ape PR #2780:** https://github.com/ApeWorX/ape/pull/2780 — official Brownie migration guide
- **ApeWorX/skills PR #9 (filed 2026-05-03):** https://github.com/ApeWorX/skills/pull/9 — new `migrate-from-brownie` skill for Claude/LLMs
- **codemod-com/codemod PR #2168:** https://github.com/codemod-com/codemod/pull/2168 — Codemod platform docs
- **bkrem/awesome-solidity PR #173 (7,024⭐):** https://github.com/bkrem/awesome-solidity/pull/173 — annotation on Brownie entry
- **rajasegar/awesome-codemods PR #7:** https://github.com/rajasegar/awesome-codemods/pull/7 — adds Python section
- **Kludex/awesome-python-codemods PR #1:** https://github.com/Kludex/awesome-python-codemods/pull/1 — Python-specific list
- **ApeWorX/ape issue #2774:** https://github.com/ApeWorX/ape/issues/2774 — original framework adoption request

### Repository Documentation
- **CASE_STUDY.md (combined 5-repo benchmark):** https://github.com/PugarHuda/brownie-to-ape/blob/main/CASE_STUDY.md
- **DEMO.md (curated diffs):** https://github.com/PugarHuda/brownie-to-ape/blob/main/DEMO.md
- **AI-step demo (token-mix):** https://github.com/PugarHuda/brownie-to-ape/blob/main/demo/ai-step-demo.md
- **APE_VERIFY_REPORT (38/38 ape test PASS log):** https://github.com/PugarHuda/brownie-to-ape/blob/main/docs/ape-verify-token-mix.log
- **Bahasa Indonesia README:** https://github.com/PugarHuda/brownie-to-ape/blob/main/README.id.md
- **Asciinema cast:** https://github.com/PugarHuda/brownie-to-ape/blob/main/demo/demo.cast

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

## Why this submission stands out

The hackathon explicitly evaluates: (1) zero false positives, (2) coverage, (3) reliability across real repos, (4) test depth. This submission was built around those criteria from day one — every claim below is reproducible from the public repo.

| Criterion | Evidence | How to verify |
|---|---|---|
| **0 false positives** | Audited via manual diff on 5 OSS repos + 90 fixture snapshot tests including 15+ negative-case fixtures (lambda, list comprehension, walrus, async/await, OrderedDict, helper functions, malformed Python, brownie-only-in-string-literal, dict-spread, etc.) | `git clone … && npm test` → 90 passed |
| **End-to-end real-repo proof** | `ape compile` ✅ + `ape test --network ::test` → **38 passed, 0 failed in 5.40s** on the migrated `brownie-mix/token-mix` after the codemod plus 6 small AI-step fixes (~30 LOC) | [`docs/ape-verify-token-mix.log`](./docs/ape-verify-token-mix.log) full pytest log committed in repo |
| **True jssg/ast-grep engine** | Every transform pass operates on the Tree-sitter Python AST via `findAll` / `field` / `kind` / `parent` calls — not regex over source text. Pass-by-pass introspection: `bash scripts/cli.ts --list-passes` | [`scripts/codemod.ts`](./scripts/codemod.ts) ~870 LOC, 17 numbered passes |
| **Test breadth** | **250 tests** = 90 fixture (snapshot) + 125 Vitest (50 helper unit + 11 property + 53 QA + 11 idempotency) + 35 pytest (16 Describe* + 13 legacy + **6 Hypothesis property-based fuzzer**). All passing in CI on every push (matrix: Linux/macOS/Windows × Node 20/22) | [`.github/workflows/test.yml`](./.github/workflows/test.yml) green on every commit |
| **Mutation-testing baseline** | Stryker on critical helpers: 38.57% baseline killed (architectural ceiling documented in [`docs/DEFERRED_FEATURES.md`](./docs/DEFERRED_FEATURES.md)) — the mutation report is committed at `reports/mutation/mutation.html` | Run `npx stryker run` |
| **Validated on Yearn Finance** | [`yearn/brownie-strategy-mix`](https://github.com/yearn/brownie-strategy-mix) — 4/7 .py files modified, ~33 patterns auto-migrated, **0 FP** | See [`CASE_STUDY.md`](./CASE_STUDY.md) row 5 |
| **Engineering rigor / honest tradeoffs** | [`docs/DEFERRED_FEATURES.md`](./docs/DEFERRED_FEATURES.md) explicitly documents what we did NOT implement (browser WASM playground, Stryker score >50%, full `accounts.add` auto-rewrite) and why each would compromise the 0 FP guarantee | — |
| **Bahasa Indonesia translation** | [`README.id.md`](./README.id.md) — full feature matrix, validation table, architecture overview | — |
| **Framework adoption (Track 3)** | 4 ecosystem PRs filed: ApeWorX/ape [#2780](https://github.com/ApeWorX/ape/pull/2780), codemod-com/codemod [#2168](https://github.com/codemod-com/codemod/pull/2168), rajasegar/awesome-codemods [#7](https://github.com/rajasegar/awesome-codemods/pull/7), Kludex/awesome-python-codemods [#1](https://github.com/Kludex/awesome-python-codemods/pull/1) | — |
| **Public case studies (Track 2)** | 3 published: [token-mix end-to-end](https://medium.com/@hudapugar/migrating-brownie-to-apeworx-ape-how-i-built-a-0-false-positive-codemod-with-250-tests-and-661f97e065e1) (Medium), [Yearn DeFi-specific](https://dev.to/hudapugar/migrating-yearn-finances-strategy-template-from-brownie-to-apeworx-ape-a-defi-specific-case-study-4m57) (dev.to), [Engineering tradeoffs](https://medium.com/@hudapugar/engineering-tradeoffs-why-we-said-no-to-features-in-a-hackathon-codemod-19e2de92897b) (Medium) | — |

The submission deliberately prefers **FN over FP** wherever the right rewrite cannot be inferred from the AST alone (contract artifacts, custom-bodied test fixtures, project-schema-dependent rewrites). The hackathon's scoring formula `100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))` weights FP heavier than FN, so this is the mathematically optimal stance.

## Author
**Pugar Huda Mantoro**
- Email: pugarhudam@gmail.com
- GitHub: [@PugarHuda](https://github.com/PugarHuda)

---

## Pre-publish checklist (status)

- [x] All 90 fixture tests passing
- [x] All 125 Vitest tests passing
- [x] All 35 pytest tests passing (incl. Hypothesis fuzzer)
- [x] Workflow YAML validated
- [x] Tested on **5** real OSS repos (incl. Yearn Finance) with **0 FP**
- [x] **End-to-end `ape compile` + `ape test` 38/38 PASS** on migrated token-mix
- [x] README (EN + ID), CASE_STUDY, DEMO, FAQ, Troubleshooting, EVALUATOR, DEFERRED_FEATURES, AI-step demo all present
- [x] CI workflows live: test (matrix), publish on tag, mutation (weekly), ape-verify (nightly), links (weekly)
- [x] **Published to Codemod registry as `@pugarhuda/brownie-to-ape@0.7.9`** ⭐
- [x] **Track 3 issue opened at ApeWorX/ape#2774** ⭐
- [x] **Track 3 PR opened at ApeWorX/ape#2780** ⭐ (additive doc reference)
- [x] LICENSE, SECURITY, CHANGELOG, CONTRIBUTING, FUNDING.yml all present
- [x] GitHub repo metadata: 12 topics, homepage URL, banner SVG, logo (SVG + PNG + JPEG)
- [x] **3 case studies published** (2 Medium + 1 dev.to)
- [x] **5 ecosystem PRs filed** (ApeWorX, Codemod, **upstream Brownie**, 2 awesome-lists)
- [ ] Submit BUIDL on DoraHacks (this form ⬅)
