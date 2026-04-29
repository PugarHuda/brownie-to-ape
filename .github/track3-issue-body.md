## Background

Brownie was deprecated in 2023 with Ape recommended as the successor. ApeWorX maintains an excellent porting guide ([academy.apeworx.io: Porting A Project From Brownie to Ape](https://academy.apeworx.io/articles/porting-brownie-to-ape)) covering API differences, but the actual migration of a moderate-sized codebase still involves 50–200 mechanical pattern rewrites — every `Contract.deploy(..., {"from": acct})` becomes `Contract.deploy(..., sender=acct)`, every `network.show_active()` becomes `networks.active_provider.network.name`, every imported contract becomes `project.<Name>`, and so on.

This is the kind of work that's tedious, error-prone, and largely deterministic — perfect for an automated codemod.

## What I built

[`brownie-to-ape`](https://github.com/PugarHuda/brownie-to-ape) is a [Codemod.com](https://codemod.com/) recipe that handles ~80–95% of the mechanical patterns in a Brownie → Ape migration with **zero false positives**. It uses ast-grep on Tree-sitter Python (Codemod's `jssg` engine), runs in ~3 seconds per repo, and is a single command:

```bash
npx codemod@latest workflow run \
  -w https://github.com/PugarHuda/brownie-to-ape \
  --target /path/to/your/brownie/project \
  --no-interactive --allow-dirty
```

### What it migrates (deterministic, 0 FP)

- `from brownie import …` rewrites with name renames (`network` → `networks`) and intelligent dropping of contract artifacts (`Token`, `FundMe` → TODO comment)
- `import brownie` → `import ape` (when used)
- `brownie.{reverts,accounts,project,config,chain}` → `ape.<attr>`
- `brownie.network.show_active()` and bare `network.show_active()` → `networks.active_provider.network.name`
- Tx-dict → kwargs: `Token.deploy(arg, {"from": x, "value": v})` → `Token.deploy(arg, sender=x, value=v)` (handles trailing kwargs, multi-line, single & double quotes, mixed quotes, trailing commas)
- `chain.mine(N)` positional → `chain.mine(num_blocks=N)`
- `chain.sleep(N)` statement → `chain.pending_timestamp += N`
- `Wei("X")` → `convert("X", int)` with auto-injection of `from ape.utils import convert`
- `ZERO_ADDRESS` import moved from `brownie` to `ape.utils`
- Exceptions: `exceptions.VirtualMachineError` → `exceptions.ContractLogicError` (and others, with a top-of-file TODO listing any unmapped exception names)
- Inline TODO for `accounts.add(pk)` flagging the move to `accounts.import_account_from_private_key(alias, passphrase, key)`
- Inline TODO for `interface.IERC20(addr)` flagging the move to Ape's `Contract(addr)` with explicit ABI loading
- Inline TODO for `Web3.toWei(...)` / `Web3.fromWei(...)` (web3.py-adjacent, very common in Brownie projects)
- Detection of Brownie's `def isolate(fn_isolation): pass` fixture with a TODO note that Ape provides `chain.isolate()` natively (only fires on trivial bodies — user-customized fixtures with `chain.snapshot()/yield/revert()` are left alone)

### Validated on four real OSS Brownie projects

| Repo | Files modified | Patterns auto-migrated | False positives |
|---|---|---|---|
| brownie-mix/token-mix | 4 / 5 .py | ~62 | **0** |
| PatrickAlphaC/brownie_fund_me | 5 / 6 .py | ~21 | **0** |
| PatrickAlphaC/smartcontract-lottery | 5 / 7 .py | ~30 | **0** |
| PatrickAlphaC/aave_brownie_py_freecode | 4 / 5 .py | ~24 | **0** |
| **Combined** | **18 / 23** | **~137** | **0** |

Plus **55 fixture tests + 13 Python unit tests** (`migrate_config.py` translator), all passing in CI. 15 of those fixtures are negative tests that explicitly prove the codemod does NOT fire in FP-risk contexts (lambda, list comprehension, walrus, async/await, OrderedDict, helper functions, malformed Python, etc.).

A bundled Python helper (`scripts/migrate_config.py`) translates `brownie-config.yaml` → `ape-config.yaml` for the well-known sections (networks, solidity remappings/version, dependencies, dotenv) and emits TODO comments for anything outside that mapping.

### What's intentionally not migrated

For zero-FP discipline, these are flagged with `# TODO(brownie-to-ape): …`:

- Contract artifacts (`Token`, `FundMe`, etc.) — Ape uses `project.<Name>`, which can't be inferred without project schema introspection
- `Contract` import (Brownie's runtime contract loader)
- Custom isolate fixtures with non-trivial bodies
- `wallets.from_key` config — Ape uses keystore via `ape accounts import`
- Unknown exception class names (we map `VirtualMachineError`, `RPCRequestError`, `ContractNotFound` — others get a top-of-file TODO)

## The ask

Two paths, either or both would help Brownie users:

1. **Reference the codemod from the [Porting A Project From Brownie to Ape](https://academy.apeworx.io/articles/porting-brownie-to-ape) article** as a "fast path" alongside the manual instructions. A migration guide that *both* explains the changes *and* offers a one-command bulk transform is materially better than a manual-only guide.
2. **Optional: host the codemod in the ApeWorX org** so it has a permanent home. Happy to transfer ownership or send a PR with the registry package.

Either way, I'd love feedback on transform priorities — patterns I should add or refine, common Brownie idioms I missed, edge cases that broke.

## Links

- **Codemod source:** https://github.com/PugarHuda/brownie-to-ape
- **Case study:** https://github.com/PugarHuda/brownie-to-ape/blob/main/CASE_STUDY.md
- **Demo (curated diffs):** https://github.com/PugarHuda/brownie-to-ape/blob/main/DEMO.md
- **Asciinema cast:** https://github.com/PugarHuda/brownie-to-ape/blob/main/demo/demo.cast
- **Latest tag:** [v0.7.3](https://github.com/PugarHuda/brownie-to-ape/releases/tag/v0.7.3)
- **Codemod platform:** https://codemod.com/
- **Ape porting guide that inspired the mappings:** https://academy.apeworx.io/articles/porting-brownie-to-ape

## Context

This was built for the [Codemod Boring AI hackathon](https://dorahacks.io/hackathon/codemod) (Track 1 — Production Migration Recipe + Track 2 — Public Case Study). Track 3 of the hackathon awards up to $2,000 if a framework maintainer references the codemod in their official upgrade guide — I'd be applying for that, and a positive response from ApeWorX maintainers would unlock it.

But genuinely, the bigger goal is just to make Brownie → Ape migrations a 30-minute task instead of a half-day task for the thousands of Python smart-contract projects still on Brownie.

Thanks for reading — and thanks for building Ape!
