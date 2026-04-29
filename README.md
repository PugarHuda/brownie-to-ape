# brownie-to-ape

Automated migration codemod from [Brownie](https://eth-brownie.readthedocs.io/) to [ApeWorx Ape](https://docs.apeworx.io/) — Python smart-contract framework migration with **zero false positives** on real OSS repos.

Built with [Codemod](https://codemod.com/) `jssg` engine (ast-grep on Tree-sitter Python). Submitted to the **Codemod Boring AI hackathon** (Track 1: Production Migration Recipes).

## What it migrates

| # | Pattern | Before (Brownie) | After (Ape) |
|---|---|---|---|
| 1 | Module import rename | `from brownie import network` | `from ape import networks` |
| 2 | Contract artifact import | `from brownie import FundMe` | `# TODO(brownie-to-ape): … FundMe` |
| 3 | Built-in unsupported names | `from brownie import exceptions, Wei` | TODO comment, dropped from import |
| 4 | Bare module import | `import brownie` (when `brownie.reverts/.accounts` used) | `import ape` |
| 5 | Reverts / accounts / project / config / chain | `brownie.reverts(...)` | `ape.reverts(...)` |
| 6 | Active network name | `brownie.network.show_active()` and bare `network.show_active()` | `networks.active_provider.network.name` |
| 7 | Tx-dict → kwargs | `Contract.deploy(arg, {"from": x, "value": v})` | `Contract.deploy(arg, sender=x, value=v)` |
| 8 | Tx-dict with trailing kwarg | `deploy(addr, {"from": x}, publish_source=...)` | `deploy(addr, sender=x, publish_source=...)` |
| 9 | `chain.mine(N)` positional arg | `chain.mine(10)` | `chain.mine(num_blocks=10)` |
| 10 | `chain.sleep(N)` as a statement | `chain.sleep(60)` | `chain.pending_timestamp += 60` |
| 11 | Brownie exception class names | `exceptions.VirtualMachineError`, `brownie.exceptions.VirtualMachineError` | `exceptions.ContractLogicError`, `ape.exceptions.ContractLogicError` |
| 12 | `accounts.add(pk)` inline TODO | `accounts.add(pk)` | `accounts.add(pk)  # TODO: Ape uses accounts.import_account_from_private_key(...)` |
| 13 | Brownie's `isolate(fn_isolation): pass` fixture | `def isolate(fn_isolation): pass` | TODO comment above the decorator (Ape has `chain.isolate()` built-in) |
| 14 | `Wei("X")` calls | `Wei("1 ether")` | `Wei("1 ether")  # TODO: from ape.utils import convert; convert("1 ether", int)` (inline TODO at safe contexts) |
| 15 | `interface.X(addr)` calls | `interface.IERC20(addr)` | `interface.IERC20(addr)  # TODO: Ape's Contract(addr) with explicit ABI/type` |
| 16 | Unknown `exceptions.X` references | `exceptions.SomeUnknownExc` | TODO at top of file listing unmapped exception names |
| Bonus | YAML config helper (`scripts/migrate_config.py`) | `brownie-config.yaml` | `ape-config.yaml` (networks, solidity, dependencies translated; legacy file preserved) |

## Install & Run

```bash
# Install Codemod CLI (one-time)
npm i -g codemod

# Run on your Brownie repo
codemod run brownie-to-ape -t /path/to/your/brownie/project

# Or run from this directory locally
cd brownie-to-ape
codemod workflow run -w workflow.yaml -t /path/to/your/brownie/project --no-interactive --allow-dirty
```

## Validated on real OSS repos

Tested on four Brownie OSS projects covering different shapes (token tutorial, simple deploy, multi-network lottery with VRF mocks, Aave DeFi integration):

| Repo | Files modified | Patterns auto-migrated | False positives |
|---|---|---|---|
| [brownie-mix/token-mix](https://github.com/brownie-mix/token-mix) | 4 / 5 `.py` | ~62 (3 imports, 30+ tx-dicts, 6 reverts, 2 bare imports, 1 isolate fixture) | **0** |
| [PatrickAlphaC/brownie_fund_me](https://github.com/PatrickAlphaC/brownie_fund_me) | 5 / 6 `.py` | ~21 (5 imports, 8 tx-dicts, 8 show_active, 1 exception rename, 1 accounts.add TODO) | **0** |
| [PatrickAlphaC/smartcontract-lottery](https://github.com/PatrickAlphaC/smartcontract-lottery) | 5 / 7 `.py` | ~30 (5 imports, 13 tx-dicts, 9 show_active, 1 exception rename) | **0** |
| [PatrickAlphaC/aave_brownie_py_freecode](https://github.com/PatrickAlphaC/aave_brownie_py_freecode) | 4 / 5 `.py` | ~24 (3 imports, 8 tx-dicts, 7 show_active, 5 interface TODOs) | **0** |

**Combined: 18/23 files modified across 4 OSS repos. ~137 patterns auto-migrated. 0 false positives.**

See [CASE_STUDY.md](./CASE_STUDY.md) for the full write-up.

## Zero-False-Positive Guards

The codemod is engineered to never make incorrect changes. Key guards:

1. **File-level marker** — transforms only run on files that contain the substring `brownie`. Files with unrelated `{"from": x}` patterns (email APIs, regular dicts) are untouched.
2. **Tx-dict whitelist** — a dict literal is treated as a Brownie tx-dict only if **every key** is in `{"from", "value", "gas", "gas_limit", "gas_price", "max_fee", "priority_fee", "nonce", "required_confs", "allow_revert"}` AND `"from"` is present.
3. **Contract-name heuristic** — uppercase names that aren't built-in Brownie module names (`accounts`, `network`, `chain`, `config`, `project`) are assumed to be contract artifacts and dropped from imports with a TODO comment.
4. **`brownie.network` not auto-renamed** — only the specific `brownie.network.show_active()` pattern is rewritten (to the specific Ape equivalent). Other `brownie.network.*` is left for manual review since Ape exposes them differently.
5. **Replace dict node, not arg list** — preserves edits to surrounding positional args (e.g. `brownie.accounts[0]` inside the same call gets renamed independently).
6. **Wildcard `from brownie import *` skipped** — too risky to rewrite without symbol tracking.

## What's NOT auto-migrated (intentionally)

These patterns are flagged with `# TODO(brownie-to-ape): …` for manual review or AI-assisted follow-up. They are by design left manual to keep FP at zero.

- **Contract artifacts** (`Token`, `FundMe`, etc.) — Ape uses `project.<ContractName>` access. The codemod can't infer the project structure.
- **`MockV3Aggregator[-1]` style** — Brownie's "last deployed" subscript. Ape uses `project.<Name>.deployments[-1]`.
- **`accounts.add(private_key)`** — Ape requires `accounts.import_account_from_private_key(alias, passphrase, key)`.
- **`chain.sleep(N)` in expressions** — Only the *statement* form is auto-migrated. `result = chain.sleep(N)` (rare — Brownie returns None) is left alone since the rewrite would change semantics.
- **`chain.mine(N, timedelta)`** — Brownie's two-arg form. Skipped (only single positional N is migrated to `num_blocks=N`).
- **`brownie.exceptions.VirtualMachineError`** — class names differ in `ape.exceptions`.
- **`brownie-config.yaml`** → `ape-config.yaml` — YAML config schema migration is out of jssg scope; needs a separate transform.

## Project Layout

```
brownie-to-ape/
├── codemod.yaml                # package metadata
├── workflow.yaml               # single-step jssg workflow
├── scripts/
│   ├── codemod.ts              # the transform (9 passes, ~370 LOC)
│   └── migrate_config.py       # supplemental YAML config converter
├── tests/fixtures/             # 33 input/expected test pairs, 100% passing
├── .github/workflows/
│   ├── test.yml                # CI fixture suite on push/PR
│   └── publish.yml             # auto-publish to registry on tag
├── README.md
├── CASE_STUDY.md               # hackathon submission write-up
├── SUBMISSION.md               # pre-filled DoraHacks BUIDL form
├── TRACK_3_ISSUE_DRAFT.md      # ApeWorX issue body for Track 3
└── CLAUDE.md                   # project context for Claude Code
```

## Development

```bash
# Run all tests
codemod jssg test -l python ./scripts/codemod.ts ./tests/fixtures

# Validate workflow schema
codemod workflow validate -w workflow.yaml

# Dry-run on a project (preview diff without writing files)
codemod workflow run -w workflow.yaml -t /path/to/repo --dry-run

# Publish to registry
codemod login
codemod publish
```

## License

MIT — see codemod.yaml.

## Author

Pugar Huda Mantoro · [pugarhudam@gmail.com](mailto:pugarhudam@gmail.com)
