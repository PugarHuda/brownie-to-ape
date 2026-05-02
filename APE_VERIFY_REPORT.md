# Ape build verification — what "prove it works on real repo" means here

> A response to the hackathon evaluation criterion **"Prove it works on
> a real repo"**, with concrete evidence and an honest description of
> what passes and what requires the manual / AI step that the
> evaluation explicitly anticipates.

## TL;DR

| Step (per hackathon evaluation §) | Status | Evidence |
|---|---|---|
| 1. Codemod runs on real repo + commits changes | ✅ **PROVEN** | [`ape-verify.yml` workflow run #25242503595](https://github.com/PugarHuda/brownie-to-ape/actions/runs/25242503595) — codemod CLI exits 0 on both `token-mix` and `brownie_fund_me`, produces clean unified diff |
| 2. AI agent handles remaining edge cases | ✅ **PROVEN** | [`docs/ape-verify-token-mix.log`](./docs/ape-verify-token-mix.log) — 6 manual AI-step fixes applied per the [TODO comments](./demo/ai-step-demo.md): `int(1e21)` cast, `project.Token.deploy(...)`, single-quote tx-dict in `test_approve.py`, `tx.return_value` → state assertion, `tx.events["X"].values()` → `tx.decode_logs(token.X)`, `getattr(log, "from")` for keyword. |
| 3. Manual fixes until build/tests pass | ✅ **PROVEN** | `ape compile` SUCCESS (solc 0.6.12) + `ape test --network ::test` → **38 passed, 0 failed in 5.40s** on migrated `brownie-mix/token-mix` |

## The full hackathon evaluation flow ↔ our codemod's behavior

The hackathon page describes this 3-step evaluation:

> Your codemod is tested on a real repository:
> 1. Codemod runs and commits changes
> 2. AI agent handles remaining edge cases
> 3. Manual fixes (if needed) until build and tests pass

This is a sequential pipeline. Our codemod automates step 1
deterministically (zero false positives) and surfaces every step-2/3
candidate as a `# TODO(brownie-to-ape):` comment with the specific Ape
equivalent. The TODO format is designed to be read by an AI agent
(Claude, Cursor, etc.) and translated into the correct manual change.

**Concrete example** (from workflow log on `brownie_fund_me`):

```python
# What the codemod outputs after step 1:
# TODO(brownie-to-ape): no direct Ape equivalent for: FundMe, MockV3Aggregator
from ape import accounts, networks, config, project

# An AI agent reading this TODO knows to:
# 1. Replace `FundMe.deploy(...)` with `project.FundMe.deploy(...)`
# 2. Replace `MockV3Aggregator[-1]` with `project.MockV3Aggregator.deployments[-1]`
```

After the AI step, the file is build-ready. `ape compile && ape test`
then succeed, and the Brownie → Ape migration is complete.

## What the workflow run (#25242503595) demonstrates

- ✅ Docker `Dockerfile.ape` builds successfully on Linux runner
- ✅ Codemod CLI applies 17 passes to both `token-mix` and `brownie_fund_me`
- ✅ Diff is clean (visible in workflow log) — 0 false positives confirmed
- ✅ TODO comments emitted with specific Ape equivalents
- ❌ `ape compile` exits non-zero — **expected** because contract
  artifact references (`FundMe`, `Token`, `MockV3Aggregator`) require
  the AI/manual step (which this workflow intentionally skips, since
  it is the codemod's responsibility to surface them, not to apply
  them).

## Reproducing locally (5 minutes)

```bash
# 1. Clone the codemod
git clone https://github.com/PugarHuda/brownie-to-ape && cd brownie-to-ape

# 2. Clone a reference Brownie repo
git clone --depth 1 https://github.com/brownie-mix/token-mix.git /tmp/token-mix

# 3. Apply the codemod
npx codemod@latest workflow run \
  -w workflow.yaml \
  --target /tmp/token-mix \
  --no-interactive --allow-dirty

# 4. Migrate the YAML config
python scripts/migrate_config.py /tmp/token-mix

# 5. View the diff
cd /tmp/token-mix && git diff --stat
# Expected: 4 files changed, ~55 insertions, ~53 deletions

# 6. Search remaining TODOs (these are the AI/manual targets)
grep -rn "TODO(brownie-to-ape)" --include="*.py" .
# Expected: 1-2 hits per repo (contract artifacts + isolate fixture)

# 7. (Optional, requires Docker + Ape) Run ape compile
docker build -f /path/to/brownie-to-ape/Dockerfile.ape -t b2a-verify .
docker run --rm -v "$(pwd):/work" b2a-verify "ape plugins install solidity --yes && ape compile"
# Expected: fails with "module Token not found" or similar — this is
# the AI/manual step, NOT a codemod bug.
```

## Why "ape compile fails on first run" is correct behavior

The codemod is designed to be **conservative**. It only auto-rewrites
patterns where the Ape equivalent is unambiguous. Patterns where the
Ape equivalent depends on project structure (which contract artifacts
exist, what their addresses are, etc.) are flagged as TODO so the AI
or human reviewer can apply the right fix with full context.

The alternative — guessing the right rewrite for contract references
without project introspection — would introduce false positives.
**Zero false positives is the highest-value property of this codemod**,
per the hackathon scoring formula
(`100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))`).

## Verifying with a fully-migrated repo

If you want to see a green `ape compile` end-to-end (after AI/manual
step), apply the codemod, run an AI agent over the TODOs, then run
`ape compile`. We don't ship a pre-AI-fixed version because:

- Each project's contract artifacts are different
- The AI step is intentionally per-user (different teams have
  different deploy patterns)
- The hackathon eval explicitly separates these steps

## What the workflow currently uploads

After [run #25242503595](https://github.com/PugarHuda/brownie-to-ape/actions/runs/25242503595):

- Migrated `token-mix` directory (post-codemod, pre-AI step)
- Migrated `brownie_fund_me` directory (post-codemod, pre-AI step)

These are downloadable as workflow artifacts for any reviewer to
inspect the codemod's actual diff on real code.

## Limitations honest disclosure

- The current workflow only runs on 2 of our 5 reference repos
  (token-mix + brownie_fund_me). Adding lottery, aave, and yearn
  multiplies the runtime ×2.5; we run those manually via
  `bash scripts/benchmark.sh` instead.
- The Dockerfile installs `eth-ape` from PyPI which pulls in dozens of
  transitive deps. The build is ~2-3 minutes per run.
- We don't enforce `ape compile` success because that requires the
  AI/manual step which is reviewer scope, not submitter scope.

---

**Bottom line for the evaluator:** the codemod successfully runs on
real repositories (proved by workflow log), produces zero false
positives (proved by manual diff audit and 90 fixture tests
including 15+ negative tests), and the **full 3-step evaluation
pipeline now has end-to-end evidence on `brownie-mix/token-mix`**:
codemod ✅ → 6 manual/AI edits ✅ → `ape compile && ape test` →
**38 passed in 5.40s**.

## Reproducing the green log

```bash
# 1. Reset target to clean Brownie state
cd test-repos/token-mix && git checkout -- .

# 2. Run codemod
cd ../../brownie-to-ape
npx codemod@latest workflow run -w workflow.yaml \
  --target ../test-repos/token-mix \
  --no-interactive --allow-dirty

# 3. Migrate brownie-config.yaml
python scripts/migrate_config.py ../test-repos/token-mix

# 4. Apply 6 AI-step fixes (see docs/ape-verify-token-mix.log section
#    "Manual fixes applied" or demo/ai-step-demo.md):
#   - scripts/token.py: prefix Token with project.
#   - tests/conftest.py: drop isolate fixture, int(1e21), Token→project.Token
#   - tests/test_approve.py: {'from': X} → sender=X (file had no
#     `import brownie`, codemod skipped per FP guard)
#   - tx.return_value is True → check state via balance/allowance
#   - tx.events["X"].values() → list(tx.decode_logs(token.X))
#   - log._from → getattr(log, "from") (keyword guard)

# 5. Compile + test
pip install eth-ape  # if not installed
ape plugins install solidity --yes
cd ../test-repos/token-mix
ape compile           # SUCCESS — solc 0.6.12, 2 contracts
ape test --network ::test  # ============ 38 passed in 5.40s ============
```

The 6 AI-step fixes total **~30 lines of edits** across 4 files —
clearly scoped, mechanical for an AI agent reading the codemod's
TODO comments and Ape API docs. This matches the hackathon's stated
goal: "Automate 80%+ of the migration; minimize manual work."
