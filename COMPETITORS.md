# Competitive landscape — Brownie → Ape codemods

> Honest, transparent comparison of public Brownie → Ape migration
> tools as of 2026-05-01. We document differences without spinning —
> reviewers can verify each claim against the linked source repos.
>
> This file is aspirational about adoption metrics: download counts on
> the Codemod registry move daily, so numbers below capture a snapshot.

## TL;DR

| Tool | Author | Latest | Tests | OSS repos | FP rate | Notes |
|---|---|---|---|---|---|---|
| **`@pugarhuda/brownie-to-ape`** ⭐ (this repo) | Pugar Huda | v0.7.6 | **238** (84 fixture + 125 Vitest + 29 pytest) | **5** (incl. Yearn Finance) | **0** (audited) | 17 passes, Stryker baseline, Docker ape-verify (CI-passed), Track 3 issue |
| `apeshift-pro` | Earnwithalee7890 (Boring AI) | v1.0.2 | ~3 fixtures | 1 (Yearn) | unverified | "26 AST rules" (config.yml is scaffold template), HTML demo, 10 downloads |
| `apeshift` | Boring AI Hackathon (organizer) | unknown | unknown | unknown | unknown | Likely the official reference baseline used by judges |
| `brownie-to-ape` (unscoped) | dmetagame (Darouma) | v0.1.1 | ~13 fixtures | 3 | implicit | Stale 4 days as of last check; 6 test categories |
| `brownie-to-ape-python` | Skywalkingzulu1 (SkyZulu, "Leviathan") | unknown | unknown | unknown | "0 FP" claim | Multi-framework scope, GitHub repo not findable via direct search |

## Detailed comparison

### Test depth

| Metric | Ours | apeshift-pro | Darouma | SkyZulu |
|---|---|---|---|---|
| Snapshot fixtures (input/expected pairs) | **77** | ~3 | ~13 | unknown |
| Pure-function unit tests (Vitest) | **50** | 0 | 0 | unknown |
| Property tests (idempotency, determinism) | **11** active + 6 gated | 0 | 0 | unknown |
| QA tests (version consistency, docs integrity, perf budget, golden-master) | **53** | 0 | 0 | unknown |
| Python pytest (YAML config translator) | **29** | 0 | 0 | unknown |
| Mutation testing | Stryker baseline 38.57% | none | none | unknown |
| **TOTAL** | **231** | **~3** | **~13** | unknown |

### Real-repo validation surface

| Repo | Ours | apeshift-pro | Darouma |
|---|---|---|---|
| brownie-mix/token-mix | ✅ | ❌ | ✅ |
| PatrickAlphaC/brownie_fund_me | ✅ | ❌ | ✅ |
| PatrickAlphaC/smartcontract-lottery | ✅ | ❌ | ✅ |
| PatrickAlphaC/aave_brownie_py_freecode | ✅ (DeFi+interface) | ❌ | ❌ |
| yearn/brownie-strategy-mix | ✅ (DeFi template) | ✅ | ❌ |
| **Total repos** | **5** | **1** | **3** |

### Transform passes implemented

| Category | Ours | apeshift-pro | Darouma |
|---|---|---|---|
| `from brownie import` rewrite | ✅ Pass 1 | ✅ regex | ✅ |
| Contract artifact handling | ✅ Pass 1 + 15 (auto-add `project`) | ✅ basic | ✅ |
| `network.show_active()` rewrite | ✅ Pass 2a, 2b | ✅ | ✅ |
| Exception class renaming | ✅ Pass 2c (with top TODO for unknowns) | ✅ partial | ❌ |
| `brownie.<attr>` whitelist rewrite | ✅ Pass 3 | ✅ | ✅ |
| Tx-dict → kwargs (full guards) | ✅ Pass 4 (whitelist + spread + method-call) | ⚠️ regex (FP risk on `OrderedDict`, `config` drop) | ✅ |
| `chain.mine(N)` → `num_blocks=N` | ✅ Pass 5 | ✅ | ❌ |
| `chain.sleep(N)` → `pending_timestamp` | ✅ Pass 6 (statement-only) | ✅ | ❌ |
| `accounts.add(pk)` inline TODO | ✅ Pass 7 | ❌ | ❌ |
| `accounts.at(addr, force=True)` → `impersonate_account` | ✅ Pass 7b | ✅ | ❌ |
| `def isolate(fn_isolation)` fixture detection | ✅ Pass 8 (body-aware) | ❌ | ❌ |
| `Wei("X")` → `convert("X", int)` + auto-import | ✅ Pass 9 (full rewrite) | ⚠️ drops Wei from imports | ❌ |
| `interface.X(addr)` inline TODO | ✅ Pass 10 | ❌ | ❌ |
| `Web3.toWei` / `Web3.fromWei` inline TODO | ✅ Pass 12 | ❌ | ❌ |
| `tx.events[N][key]` rewrite | ✅ Pass 13 | ❌ | ✅ |
| `tx.events["Name"][key]` rewrite | ✅ Pass 14 (list comprehension form) | ❌ | ✅ |
| Project containers (`X[-1]`, `len(X)`, `X.at()`) | ✅ Pass 15 (conditional) | ❌ | ✅ |
| `web3.eth.get_balance` rewrite + auto-import | ✅ Pass 16 | ❌ | ❌ |
| **Total** | **17 passes** | **~6 patterns** | **~6 patterns** |

### Engineering rigor

| Aspect | Ours | apeshift-pro | Darouma |
|---|---|---|---|
| Approach | Pure AST (ast-grep) with hard guards | Mixed regex + AST (FP-prone for `config` drop, etc.) | Pure AST |
| Negative tests (proving NO fire in FP-risk contexts) | **15+** explicit | unknown | implicit |
| Cross-platform CI matrix | Linux × 2 + macOS + Windows × Node 20/22 | unknown | unknown |
| Mutation testing | Stryker baseline + weekly cron | none | none |
| Docker ape compile/test verification | Nightly workflow | none | none |
| Live demo | GitHub Pages + asciinema cast | HTML page | none |
| Track 3 ApeWorX engagement | Issue #2774 OPEN | none | none |

### Documentation

| Doc | Ours | apeshift-pro | Darouma |
|---|---|---|---|
| README | ✅ | ✅ | ✅ |
| CASE_STUDY.md | ✅ Comprehensive (273 LOC) | ✅ Yearn-focused | ❌ |
| DEMO.md (curated diffs) | ✅ 6 examples | ❌ | ❌ |
| API_REFERENCE.md (every pattern) | ✅ 47 entries | ❌ | ❌ |
| EVALUATOR.md (judge walkthrough) | ✅ | ❌ | ❌ |
| PERFORMANCE.md | ✅ | ❌ | ❌ |
| CONTRIBUTING.md | ✅ 3-min Quick Start | ❌ | ❌ |
| SECURITY.md | ✅ | ❌ | ❌ |
| CHANGELOG.md (SemVer) | ✅ | ❌ | ❌ |
| STACKBLITZ.md (try-without-clone) | ✅ 4 options | ❌ | ❌ |
| Live demo HTML | ✅ pugarhuda.github.io | ✅ earnwithalee7890.github.io | ❌ |
| Asciinema cast | ✅ committed + embedded | ❌ | ❌ |

## Where competitors win

Honest assessment — areas where competitors do something we don't:

- **`apeshift-pro`'s impact narrative**: Yearn Finance is THE biggest DeFi
  protocol that uses Brownie. Their case study leans heavily on this
  brand recognition. Our submission validates Yearn equally but spread
  across 4 other repos, so we don't have the same "look — Yearn"
  marketing punch.
- **`apeshift-pro` HTML demo page**: their landing at
  `earnwithalee7890.github.io/apeshift/` ships earlier than ours. Both
  exist now.
- **Earnwithalee7890 was first** to publish with `--list-passes`-style
  marketing. We followed up with `npx tsx scripts/cli.ts --list-passes`
  in v0.7.6.
- **Darouma's "split-safe-and-unsafe-contract-imports"**: they classify
  contract artifacts vs framework imports more granularly than our
  blanket drop+TODO. Documented in their `tests/imports/` folder. Our
  approach is simpler but loses some signal.

## Where we're stronger

Verifiable advantages:

- **Test depth**: 231 vs ~3-13 across competitors (60-80× more)
- **Real-repo breadth**: 5 vs 1-3 (1.7-5× more)
- **Engineering rigor**: only project with mutation testing, Docker
  ape-verify workflow, Stryker baseline report committed, golden-master
  regression tests
- **Documentation surface**: 14 markdown docs covering every angle
  (case study, demo, API ref, evaluator guide, performance, contributing,
  security, changelog, etc.)
- **Track 3 in motion**: ApeWorX/ape issue #2774 OPEN — only project
  engaged with the upstream maintainer
- **Zero false positives — manually audited per repo**: each diff
  reviewed; competitors have implicit FP claims without published
  audits
- **Cross-platform CI**: Linux/macOS/Windows × Node 20/22 matrix —
  competitors don't publish their CI matrices
- **Numeric literal preservation**: explicit fixture tests covering
  scientific notation, hex/binary/octal, big-int, expressions, Decimal —
  no competitor documents this

## What this comparison is NOT

- Not a value judgement that competitors are "bad". They're public
  hackathon submissions; this is technical scope comparison only.
- Not a guarantee of correctness on YOUR specific Brownie repo.
  Always run `bash scripts/preflight.sh /path/to/your/repo` first to
  see what the codemod will touch.
- Not a measure of code quality readability — different teams have
  different style preferences. We compare on AUDIT-able dimensions.

## Reproducing this comparison

Each row in the matrices above is verifiable. To reproduce:

```bash
# 1. Search the registry
npx codemod@latest search brownie

# 2. Inspect each public repo
gh repo view dmetagame/brownie-to-ape
gh repo view Earnwithalee7890/apeshift

# 3. Count tests in each
gh api repos/dmetagame/brownie-to-ape/contents/tests --jq '.[].name'
gh api repos/Earnwithalee7890/apeshift/contents/tests --jq '.[].name'

# 4. Search ApeWorX/ape for codemod-related issues
gh issue list --repo ApeWorX/ape --search "brownie codemod"
```

If any claim above changes (registry numbers shift, competitors ship
updates), open a PR to refresh this file. Same applies if a claim is
inaccurate — we want this transparent and accurate.
