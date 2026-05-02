# API Reference — every Brownie pattern & its Ape equivalent

> Comprehensive mapping of Brownie's API surface to Ape's, indicating
> which transforms the codemod handles automatically and which you'll
> need to migrate manually.
>
> Last updated: v0.7.9.

## Auto-migrated (deterministic, 0 FP)

| # | Brownie | Ape | Pass | Notes |
|---|---|---|---|---|
| 1 | `from brownie import accounts` | `from ape import accounts` | 1 | name preserved |
| 2 | `from brownie import network` | `from ape import networks` | 1 | renamed (singular → plural) |
| 3 | `from brownie import chain` | `from ape import chain` | 1 | name preserved |
| 4 | `from brownie import project` | `from ape import project` | 1 | name preserved |
| 5 | `from brownie import config` | `from ape import config` | 1 | name preserved |
| 6 | `from brownie import ZERO_ADDRESS` | `from ape.utils import ZERO_ADDRESS` | 1 | moved to `ape.utils` |
| 7 | `from brownie import Wei` | dropped (auto-import `convert`) | 1 + 9 | replaced by `convert` calls |
| 8 | `from brownie import web3` | `from brownie import web3` + TODO | 1 | preserved (Pass 16 partially rewrites) |
| 9 | `from brownie import <ContractName>` | dropped + auto-add `project` | 1 + 15 | references rewritten by Pass 15 |
| 10 | `import brownie` (when used) | `import ape` | 3b | only if Pass 3 fired |
| 11 | `brownie.reverts(...)` | `ape.reverts(...)` | 3 | |
| 12 | `brownie.accounts[0]` | `ape.accounts[0]` | 3 | |
| 13 | `brownie.chain.X` | `ape.chain.X` | 3 | |
| 14 | `brownie.network.show_active()` | `networks.active_provider.network.name` | 2a | |
| 15 | `network.show_active()` (after import) | same as above | 2b | |
| 16 | `Token.deploy(arg, {"from": x})` | `Token.deploy(arg, sender=x)` | 4 | method-call only |
| 17 | `c.method(arg, {"from": x, "value": v})` | `c.method(arg, sender=x, value=v)` | 4 | multiple kwargs |
| 18 | `c.method(arg, {"from": x}, kwarg=y)` | `c.method(arg, sender=x, kwarg=y)` | 4 | trailing kwarg preserved |
| 19 | `chain.mine(10)` | `chain.mine(num_blocks=10)` | 5 | positional → kwarg |
| 20 | `chain.sleep(60)` (statement) | `chain.pending_timestamp += 60` | 6 | statement context only |
| 21 | `accounts.at(addr, force=True)` | `accounts.impersonate_account(addr)` | 7b | strict force-keyword |
| 22 | `Wei("1 ether")` | `convert("1 ether", int)` + auto-import | 9 | `from ape.utils import convert` injected |
| 23 | `exceptions.VirtualMachineError` | `exceptions.ContractLogicError` | 2c | known mappings |
| 24 | `exceptions.RPCRequestError` | `exceptions.RPCError` | 2c | |
| 25 | `exceptions.ContractNotFound` | `exceptions.ContractNotFoundError` | 2c | |
| 26 | `brownie.exceptions.X` (qualified) | `ape.exceptions.<MappedX>` | 2c | |
| 27 | `tx.events[0]["key"]` | `tx.events[0].event_arguments["key"]` | 13 | integer inner key |
| 28 | `tx.events["Name"]["key"]` | `[log for log in tx.events if log.event_name == "Name"][0].event_arguments["key"]` | 14 | string inner key, list comprehension form |
| 29 | `MyContract[-1]` (with `from ape import project`) | `project.MyContract.deployments[-1]` | 15 | |
| 30 | `len(MyContract)` (same condition) | `len(project.MyContract.deployments)` | 15 | |
| 31 | `MyContract.at(addr)` (same condition) | `project.MyContract.at(addr)` | 15 | |
| 32 | `web3.eth.get_balance(addr)` | `chain.get_balance(addr)` + auto-import | 16 | `from ape import chain` injected |

## Inline-TODO flagged (needs human / AI review)

| Brownie | Ape (intended) | Pass | Why not auto |
|---|---|---|---|
| `accounts.add(pk)` | `accounts.import_account_from_private_key(alias, passphrase, key)` | 7 | 3 args required, can't infer from 1 |
| `interface.IERC20(addr)` | `Contract(addr)` with explicit ABI | 10 | Ape requires ABI/type per call |
| `Web3.toWei(0.1, "ether")` | `convert("0.1 ether", int)` | 12 | string format differs |
| `Web3.fromWei(amt, "ether")` | `Decimal(amt) / 10**18` or similar | 12 | inverse op, depends on context |
| `def isolate(fn_isolation): pass` | (delete the fixture) | 8 | Ape provides `chain.isolate()` natively |

## Top-of-file TODO

| Trigger | TODO content |
|---|---|
| `exceptions.<UnknownName>` | Lists unmapped exception names (Ape's class names differ) |

## NOT migrated (manual work)

| Brownie | Why not in scope | Manual approach |
|---|---|---|
| `brownie-config.yaml` (full schema) | YAML, not Python AST | Run `python scripts/migrate_config.py /path/to/repo` |
| `brownie test` CLI command | shell-level, not Python | `ape test` |
| `brownie compile` | shell-level | `ape compile` |
| `brownie console` | interactive shell | `ape console` |
| `brownie networks` config | config file domain | manually port to `ape-config.yaml` |
| Custom Brownie scripts (e.g. `brownie run scripts/deploy.py`) | shell-level | `ape run scripts/deploy.py` |
| `from brownie.network import gas_price` (submodule imports) | Pass 1's regex `^brownie$` only matches root | Manually replace |
| `history` global | different transaction history API in Ape | Manually port |
| `rpc` test backend | different test framework | Manually port |
| `interface.IERC20(addr).balanceOf(account)` (chained interface call) | Pass 10 only annotates with TODO | Refactor to use `Contract(addr)` with ABI |

## When in doubt

1. Run `bash scripts/preflight.sh /path/to/your/repo` for a pattern surface count.
2. Run `npx codemod@latest @pugarhuda/brownie-to-ape -t /path/to/repo --dry-run` for a preview without changes.
3. After applying, search for `# TODO(brownie-to-ape)` to find every spot that needs manual review.
4. See [DEMO.md](./DEMO.md) for curated before/after examples.
5. See [PERFORMANCE.md](./PERFORMANCE.md) for timing expectations.
