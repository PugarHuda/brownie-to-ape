# Track 3: Draft GitHub Issue for ApeWorX/ape

Pre-written body for the issue mas Huda will open at https://github.com/ApeWorX/ape/issues/new

---

## Title (≤ 72 chars)

```
Reference brownie-to-ape codemod from migration docs to ease Brownie-user onboarding
```

## Body

```markdown
## Background

Brownie was deprecated in 2023 with Ape recommended as the successor. ApeWorX
maintains an excellent porting guide ([academy.apeworx.io: Porting A Project From Brownie to Ape](https://academy.apeworx.io/articles/porting-brownie-to-ape))
covering API differences, but the actual migration of a moderate-sized codebase
still involves 50–200 mechanical pattern rewrites — every `Contract.deploy(..., {"from": acct})`
becomes `Contract.deploy(..., sender=acct)`, every `network.show_active()` becomes
`networks.active_provider.network.name`, every imported contract becomes `project.<Name>`,
and so on.

This is the kind of work that's tedious, error-prone, and largely deterministic — perfect
for an automated codemod.

## What I built

[`brownie-to-ape`](https://github.com/<your-fork-or-pugarhudam>/brownie-to-ape)
is a [Codemod.com](https://codemod.com/) recipe that handles ~80–95% of the mechanical
patterns in a Brownie → Ape migration with **zero false positives**. It uses
ast-grep on Tree-sitter Python (Codemod's `jssg` engine), runs in ~3 seconds per
repo, and is a single command:

```bash
npx codemod@latest brownie-to-ape --target /path/to/your/brownie/project
```

### What it migrates (deterministic, 0 FP)

- `from brownie import …` rewrites with name renames (`network` → `networks`)
  and intelligent dropping of contract artifacts (`Token`, `FundMe` → TODO comment)
- `import brownie` → `import ape` (when used)
- `brownie.{reverts,accounts,project,config,chain}` → `ape.<attr>`
- `brownie.network.show_active()` and bare `network.show_active()` → `networks.active_provider.network.name`
- Tx-dict `→` kwargs: `Token.deploy(arg, {"from": x, "value": v})` → `Token.deploy(arg, sender=x, value=v)`
  (handles trailing kwargs, multi-line, single & double quotes)
- `chain.mine(N)` positional → `chain.mine(num_blocks=N)`
- `chain.sleep(N)` statement → `chain.pending_timestamp += N`
- Exceptions: `exceptions.VirtualMachineError` → `exceptions.ContractLogicError`
  (and others)
- Inline TODO comment for `accounts.add(pk)` flagging the move to
  `accounts.import_account_from_private_key(alias, passphrase, key)`
- Detection of Brownie's `def isolate(fn_isolation): pass` fixture with a
  TODO note that Ape provides `chain.isolate()` natively

### Validated on three real OSS Brownie projects

| Repo | Files modified | Patterns auto-migrated | False positives |
|---|---|---|---|
| brownie-mix/token-mix | 4 / 5 .py | ~62 | **0** |
| PatrickAlphaC/brownie_fund_me | 5 / 6 .py | ~21 | **0** |
| PatrickAlphaC/smartcontract-lottery | 5 / 7 .py | ~30 | **0** |

Plus 33 fixture tests in CI.

A bundled Python helper (`scripts/migrate_config.py`) translates
`brownie-config.yaml` → `ape-config.yaml` for the well-known sections
(networks, solidity remappings/version, dependencies) and emits TODO comments
for anything outside that mapping.

### What's intentionally not migrated

For zero-FP discipline, these are flagged with `# TODO(brownie-to-ape): …`:

- Contract artifacts (`Token`, `FundMe`, etc.) — Ape uses `project.<Name>`,
  which can't be inferred without project schema introspection
- `Contract` import (Brownie's runtime contract loader)
- Custom isolate fixtures with non-trivial bodies
- `wallets.from_key` config — Ape uses keystore via `ape accounts import`

## The ask

Two paths, either or both would help Brownie users:

1. **Reference the codemod from the [Porting A Project From Brownie to Ape](https://academy.apeworx.io/articles/porting-brownie-to-ape)
   article** as a "fast path" alongside the manual instructions. A migration
   guide that *both* explains the changes *and* offers a one-command bulk
   transform is materially better than a manual-only guide.
2. **Optional: host the codemod in the ApeWorX org** so it has a permanent
   home. Happy to transfer ownership / make a PR with the registry package.

Either way, I'd love feedback on transform priorities — patterns I should
add or refine, common Brownie idioms I missed, edge cases that broke.

## Links

- Codemod source: https://github.com/<your-fork-or-pugarhudam>/brownie-to-ape
- Codemod registry package: https://app.codemod.com/registry/brownie-to-ape (after publish)
- Case study: https://github.com/<your-fork-or-pugarhudam>/brownie-to-ape/blob/main/CASE_STUDY.md
- Codemod platform: https://codemod.com/
- Ape porting guide that inspired the mappings: https://academy.apeworx.io/articles/porting-brownie-to-ape

## Context

This was built for the [Codemod Boring AI hackathon](https://dorahacks.io/hackathon/codemod)
(Track 1 — Production Migration Recipe + Track 2 — Public Case Study).
Track 3 of the hackathon awards up to $2,000 if a framework maintainer
references the codemod in their official upgrade guide — I'd be applying for
that, and a positive response from ApeWorX maintainers would unlock it.

But genuinely, the bigger goal is just to make Brownie → Ape migrations a
30-minute task instead of a half-day task for the thousands of Python
smart-contract projects still on Brownie.
```

---

## After opening the issue

- [ ] Replace `<your-fork-or-pugarhudam>` placeholder above with your actual GitHub username/org once the repo is pushed
- [ ] Replace the registry URL with your actual scope (e.g. `@pugarhudam/brownie-to-ape`)
- [ ] Cross-link from the BUIDL submission on DoraHacks under the "Track 3 (Framework Adoption)" section
- [ ] If maintainers respond positively, follow up with a PR to ApeWorX/ape adding a one-line reference in the porting guide

## Tracking

Once submitted, paste the issue URL here for the case study update:
- `https://github.com/ApeWorX/ape/issues/<NNN>`
