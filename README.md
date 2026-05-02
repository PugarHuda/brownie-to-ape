# brownie-to-ape

[![CI](https://github.com/PugarHuda/brownie-to-ape/actions/workflows/test.yml/badge.svg)](https://github.com/PugarHuda/brownie-to-ape/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./codemod.yaml)
[![Tests](https://img.shields.io/badge/tests-77%20fixture%20%2B%20154%20unit-brightgreen)](./tests)
[![FP Rate](https://img.shields.io/badge/false--positives-0-brightgreen)](./CASE_STUDY.md)
[![Validated repos](https://img.shields.io/badge/OSS%20repos%20validated-5-blue)](./CASE_STUDY.md)
[![Version](https://img.shields.io/badge/version-0.7.6-blue)](./CHANGELOG.md)
[![Mutation](https://img.shields.io/badge/mutation%20baseline-38.57%25-yellow)](./reports/mutation/mutation.html)
[![jssg](https://img.shields.io/badge/engine-Codemod%20jssg-orange)](https://docs.codemod.com/jssg/intro)

Automated migration codemod from [Brownie](https://eth-brownie.readthedocs.io/) to [ApeWorx Ape](https://docs.apeworx.io/). 17-pass deterministic transform built on [Codemod's `jssg` engine](https://docs.codemod.com/jssg/intro). Validated on **5 real OSS Brownie projects (incl. Yearn Finance) with zero false positives**.

> Submitted to the **Codemod Boring AI hackathon** (Track 1: Production Migration Recipes + Track 2: Public Case Study).

> **Live demo:** https://pugarhuda.github.io/brownie-to-ape/
> **Registry:** `@pugarhuda/brownie-to-ape` ([app.codemod.com](https://app.codemod.com/registry/@pugarhuda/brownie-to-ape))

## TL;DR

```bash
# Run on any Brownie project (~3 seconds end-to-end after first invocation)
npx codemod@latest @pugarhuda/brownie-to-ape -t /path/to/your/brownie/project

# Or via direct workflow URL:
npx codemod@latest workflow run \
  -w https://github.com/PugarHuda/brownie-to-ape \
  --target /path/to/your/brownie/project \
  --no-interactive --allow-dirty
```

Or:

```bash
# Try the bundled demo on a public repo:
git clone https://github.com/PugarHuda/brownie-to-ape && cd brownie-to-ape
bash demo/run-demo.sh
```

> 📋 **Hackathon evaluator?** See [EVALUATOR.md](./EVALUATOR.md) for the
> 3-step evaluation walkthrough (~15–20 min total): codemod run → AI
> cleanup → `ape compile && ape test` verification.

## Why use this

Brownie was deprecated in 2023; ApeWorX Ape is the recommended successor. A typical Brownie test suite contains 50–200 mechanical pattern rewrites: every `Contract.deploy(…, {"from": acct})` becomes `Contract.deploy(…, sender=acct)`, every `network.show_active()` becomes `networks.active_provider.network.name`, etc.

| | Manual migration | brownie-to-ape |
|---|---|---|
| Time per repo (typical) | half-day to 1 day | ~30 minutes (3s codemod + AI/human review) |
| Mechanical pattern rewrites | 100% manual | ~80–95% automated |
| Tx-dict → kwargs (deploy / method calls) | Find-replace per file | One pass, zero FP |
| `network.show_active()` in subscripts/f-strings | Hand-edit each | Auto-rewritten |
| Exception class renames | Look up Ape docs per name | `VirtualMachineError` → `ContractLogicError` automatic |
| Risk of regressions | Medium (typos, missed sites) | Zero (validated on 4 OSS repos) |
| `brownie-config.yaml` → `ape-config.yaml` | Manual rewrite | [`scripts/migrate_config.py`](./scripts/migrate_config.py) handles known fields |

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

See [CASE_STUDY.md](./CASE_STUDY.md) for the full write-up, [DEMO.md](./DEMO.md) for curated before/after examples, and [`benchmark/results.md`](./benchmark/results.md) for timed runs across all four repos.

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
│   ├── codemod.ts              # the transform (11 passes, ~510 LOC)
│   ├── migrate_config.py       # supplemental YAML config converter
│   └── benchmark.sh            # multi-repo perf benchmark
├── demo/
│   └── run-demo.sh             # self-contained demo (asciinema-friendly)
├── benchmark/results.md        # latest benchmark output
├── tests/fixtures/             # 51 input/expected test pairs, 100% passing
├── .github/workflows/
│   ├── test.yml                # CI fixture suite on push/PR
│   └── publish.yml             # auto-publish to registry on tag
├── README.md
├── DEMO.md                     # curated before/after examples
├── CASE_STUDY.md               # hackathon submission write-up
├── SUBMISSION.md               # pre-filled DoraHacks BUIDL form
├── TRACK_3_ISSUE_DRAFT.md      # ApeWorX issue body for Track 3
└── CLAUDE.md                   # project context for Claude Code
```

## Development

```bash
# Quick (npm scripts):
npm test            # 46 fixture tests
npm run validate    # workflow schema validation
npm run benchmark   # time codemod on 4 reference repos
npm run demo        # clone + run codemod + show diff
npm run render-cast # regenerate demo/demo.cast

# Or directly:
codemod jssg test -l python ./scripts/codemod.ts ./tests/fixtures
codemod workflow validate -w workflow.yaml
codemod workflow run -w workflow.yaml -t /path/to/repo --dry-run
codemod login && codemod publish
```

## Rollback

If a codemod run produces something unexpected, every change is in your
target repo's working tree:

```bash
cd /path/to/your/brownie/project
git checkout -- '*.py'   # discard all .py changes
```

The codemod never touches files outside `--target` and never overwrites
untracked files (the YAML helper renames legacy → `.legacy`).

## Demo cast

A pre-recorded asciinema cast at [`demo/demo.cast`](./demo/demo.cast)
(asciicast v2, 44 events, ~14s). Play locally:

```bash
asciinema play demo/demo.cast
```

## FAQ

**Q: Will running this break my codebase?**
A: No. Every change is in your working tree until you `git commit`. If
the diff looks wrong, run `git checkout -- '*.py'` to discard. The
codemod is engineered for zero false positives — validated on 4 OSS
repos.

**Q: I don't trust it. Can I preview first?**
A: Yes. `bash scripts/preview.sh /path/to/your/project` runs in dry-run
mode and prints a per-file edit summary without modifying anything.
Or use `--dry-run` directly with `codemod workflow run`.

**Q: My project uses Brownie + web3.py heavily. Will this migrate
web3.py too?**
A: Partially. `Web3.toWei(...)` and `Web3.fromWei(...)` get inline
TODO comments pointing to Ape's `convert(...)`. Other web3.py patterns
(`web3.eth.X`) are untouched — they're a different framework upgrade
([web3.py v6 → v7](https://web3py.readthedocs.io/en/stable/v7_migration.html))
that warrants its own codemod.

**Q: How long does manual cleanup take after the codemod?**
A: Most projects: 5–30 minutes. The remaining work is ~5–20% of the
migration: replace contract artifact references with `project.<Name>`,
configure accounts via `ape accounts import`, run `ape compile` and
fix any compile errors. The codemod's TODO comments mark every spot
that needs attention.

**Q: Do I have to use the bundled YAML config converter?**
A: Optional but recommended. `python scripts/migrate_config.py .`
translates `brownie-config.yaml` to `ape-config.yaml` for known
fields. If you'd rather convert the YAML manually, just don't run it
— the codemod doesn't depend on it.

**Q: Why is my first run so slow?**
A: `npx` downloads the Codemod CLI on first invocation (~10–20s).
Subsequent runs are ~3 seconds. Install once with `npm i -g codemod`
to skip this.

**Q: I have feature X (Curve / Yearn / etc.) in my Brownie repo. Will
it work?**
A: The codemod only transforms Brownie SDK patterns — it doesn't
touch protocol-specific code. Validated repos already cover token
contracts, fund-me oracles, lottery + VRF, and Aave DeFi integration.
If you hit a Brownie pattern that isn't migrated, file a feature
request.

## Troubleshooting

**Symptom:** `codemod: command not found`
- Use `npx codemod@latest …` (no global install needed).
- Or install once: `npm i -g codemod`.

**Symptom:** `codemod` runs but no files change.
- The target may not be a Brownie project — only files containing the
  substring `brownie` are processed.
- Run `bash scripts/preview.sh <target>` to see whether anything is
  detected.

**Symptom:** `from ape import …` line is missing some name.
- The codemod intentionally drops names that have no direct Ape
  equivalent (contract artifacts, `Wei`, `interface`, etc.). Look for
  `# TODO(brownie-to-ape):` comments above the rewritten import.

**Symptom:** `ape compile` fails with `NameError: contract not defined`.
- Brownie auto-injects contract artifacts into every namespace; Ape
  doesn't. Replace `MyContract.deploy(...)` with
  `project.MyContract.deploy(...)`. The codemod's TODO comment marks
  these.

**Symptom:** `pytest` fails with `AttributeError: module 'ape.exceptions'
has no attribute 'X'`.
- The codemod maps `VirtualMachineError` → `ContractLogicError` and a
  few others, but unknown exception names need manual lookup. Check
  the [Ape exceptions docs](https://docs.apeworx.io/ape/stable/methoddocs/exceptions.html).

**Symptom:** Output has duplicate `from ape.utils import convert`.
- Bug — file an issue. The dedup check (Pass 9) should catch this.

**Symptom:** Codemod CLI hangs in CI.
- Pass `--no-interactive --allow-dirty` flags. The CLI prompts for
  confirmation by default if the target isn't a clean git tree.

## License

MIT — see codemod.yaml.

## Author

Pugar Huda Mantoro · [pugarhudam@gmail.com](mailto:pugarhudam@gmail.com)
