# DoraHacks BUIDL Submission — brownie-to-ape

Pre-filled form fields untuk submit ke https://dorahacks.io/hackathon/codemod/buidl

---

## Project Name
`brownie-to-ape`

## Tagline / Short Description (≤140 chars)
> Automated Brownie → ApeWorx Ape migration codemod. 4-pass jssg transform, 19 tests, validated on 2 OSS repos with **zero false positives**.

## Category Tags
- AI-assisted coding
- Code migrations
- Automated coding
- Codemod
- Python
- Smart contracts

## Tracks Targeted
- ✅ **Track 1: Production Migration Recipe** (Size: M — ~1 week effort, target $200)
- ✅ **Track 2: Public Case Study** (target $200)
- 🔲 Track 3: Framework Adoption (aspirational — discussion issue on ApeWorX/ape pending)

## Full Description

Brownie was deprecated in 2023; ApeWorx Ape is the recommended successor. Thousands of public Python smart-contract projects still need to migrate, with each migration involving 50–200 mechanical pattern rewrites.

`brownie-to-ape` automates 80–95% of this work with **zero false positives**. The remaining 5–20% (mostly contract artifact references that require project schema introspection) is auto-flagged with `# TODO(brownie-to-ape):` comments for AI cleanup or manual review.

### Built with
- Codemod CLI + `jssg` engine (NOT jscodeshift — explicitly disallowed by hackathon rules)
- ast-grep on Tree-sitter Python grammar
- TypeScript transform code (~220 LOC, 4 ordered passes)

### What it migrates (auto-deterministic, 0 FP)
1. `from brownie import …` → `from ape import …` with name renames (`network` → `networks`) and contract drops
2. `import brownie` → `import ape` (only when `brownie.<attr>` was rewritten)
3. `brownie.{reverts,accounts,project,config,chain}` → `ape.<attr>`
4. `brownie.network.show_active()` and bare `network.show_active()` → `networks.active_provider.network.name`
5. tx-dict → kwargs: `Contract.deploy(arg, {"from": x, "value": v})` → `Contract.deploy(arg, sender=x, value=v)`
6. Tx-dict with trailing kwarg (e.g. `publish_source=...`)

### Validated on
- [`brownie-mix/token-mix`](https://github.com/brownie-mix/token-mix) — 4/5 .py files modified, 0 FP
- [`PatrickAlphaC/brownie_fund_me`](https://github.com/PatrickAlphaC/brownie_fund_me) — 5/6 .py files modified, 0 FP

### Test suite
19 input/expected fixture pairs covering all transforms + FP edge cases. 100% passing.

```
test result: ok. 19 passed; 0 failed; 0 ignored
```

## Links
- **GitHub repo:** `<insert your fork URL here>`
- **Codemod registry package:** `https://app.codemod.com/registry/brownie-to-ape` (after publish)
- **Case Study:** [CASE_STUDY.md](./CASE_STUDY.md)
- **Test repos used for validation:** linked above

## How to test (for evaluators)

```bash
git clone <repo>
cd brownie-to-ape

# Run unit tests
npx codemod@latest jssg test -l python ./scripts/codemod.ts ./tests/fixtures
# Expected: 19 passed; 0 failed

# Run on a real Brownie repo
git clone --depth 1 https://github.com/brownie-mix/token-mix.git /tmp/token-mix
npx codemod@latest workflow run -w workflow.yaml --target /tmp/token-mix --no-interactive --allow-dirty
cd /tmp/token-mix && git diff --stat
# Expected: 4 files modified, 0 incorrect changes
```

## Coverage / Scoring breakdown

Following the hackathon scoring formula `100 × (1 − ((FP × wFP) + (FN × wFN)) ÷ (N × (wFP + wFN)))`:

- Token-mix: ~62 patterns total, 0 FP, 1 contract-related FN → high score
- Fund-me: ~21 patterns total, 0 FP, 4 contract-related FN → high score (FNs are by design — Ape's `project.X` API can't be inferred without schema)

## Author
**Pugar Huda Mantoro**
Email: pugarhudam@gmail.com

---

## Pre-publish checklist

Before publishing to registry + submitting:

- [x] All 19 fixture tests passing
- [x] Workflow YAML validated
- [x] Tested on 2 real OSS repos with 0 FP
- [x] README.md complete
- [x] CASE_STUDY.md complete
- [ ] `npx codemod@latest login` (GitHub OAuth)
- [ ] `npx codemod@latest publish` from project root
- [ ] Verify package visible at `https://app.codemod.com/registry/<scope>/brownie-to-ape`
- [ ] Push to a public GitHub repo (recommended scope: `@pugarhudam/brownie-to-ape` to match your GitHub username)
- [ ] Submit BUIDL on DoraHacks with the URLs filled in above
- [ ] Optional: open a GitHub issue on `ApeWorX/ape` linking to the codemod for Track 3 adoption attempt
