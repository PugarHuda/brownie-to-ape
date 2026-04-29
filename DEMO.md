# Demo — what brownie-to-ape actually does

Real diffs from running the codemod on four public OSS Brownie repos. **Zero
false positives** across all of them.

Reproduce these results in ~30 seconds:

```bash
git clone https://github.com/brownie-mix/token-mix /tmp/token-mix
git clone https://github.com/PugarHuda/brownie-to-ape /tmp/brownie-to-ape
cd /tmp/brownie-to-ape
npx codemod@latest workflow run -w workflow.yaml \
  --target /tmp/token-mix --no-interactive --allow-dirty
cd /tmp/token-mix && git diff
```

Or run the bundled demo script:

```bash
bash demo/run-demo.sh
```

Or regenerate the full benchmark table from scratch:

```bash
bash scripts/benchmark.sh
```

---

## Example 1 — Tx-dict → kwargs (the most pervasive Brownie pattern)

**File:** [`tests/test_transferFrom.py`](https://github.com/brownie-mix/token-mix/blob/master/tests/test_transferFrom.py) (token-mix)

**Brownie:**
```python
import brownie

def test_insufficient_balance(accounts, token):
    balance = token.balanceOf(accounts[0])

    token.approve(accounts[1], balance + 1, {'from': accounts[0]})
    with brownie.reverts():
        token.transferFrom(accounts[0], accounts[2], balance + 1, {'from': accounts[1]})
```

**After codemod:**
```python
import ape

def test_insufficient_balance(accounts, token):
    balance = token.balanceOf(accounts[0])

    token.approve(accounts[1], balance + 1, sender=accounts[0])
    with ape.reverts():
        token.transferFrom(accounts[0], accounts[2], balance + 1, sender=accounts[1])
```

Three transforms applied in one file:
- `import brownie` → `import ape`
- `brownie.reverts()` → `ape.reverts()`
- 2× tx-dict → kwargs (with single quotes preserved as input)

---

## Example 2 — `network.show_active()` in subscript / f-string contexts

**File:** [`scripts/helpful_scripts.py`](https://github.com/PatrickAlphaC/brownie_fund_me/blob/main/scripts/helpful_scripts.py) (brownie_fund_me)

**Brownie:**
```python
from brownie import network, config, accounts, MockV3Aggregator

def get_account():
    if (
        network.show_active() in LOCAL_BLOCKCHAIN_ENVIRONMENTS
        or network.show_active() in FORKED_LOCAL_ENVIRONMENTS
    ):
        return accounts[0]
    return accounts.add(config["wallets"]["from_key"])


def deploy_mocks():
    print(f"The active network is {network.show_active()}")
    if len(MockV3Aggregator) <= 0:
        MockV3Aggregator.deploy(DECIMALS, STARTING_PRICE, {"from": get_account()})
```

**After codemod:**
```python
# TODO(brownie-to-ape): no direct Ape equivalent for: MockV3Aggregator
from ape import networks, config, accounts

def get_account():
    if (
        networks.active_provider.network.name in LOCAL_BLOCKCHAIN_ENVIRONMENTS
        or networks.active_provider.network.name in FORKED_LOCAL_ENVIRONMENTS
    ):
        return accounts[0]
    return accounts.add(config["wallets"]["from_key"])  # TODO(brownie-to-ape): Ape uses accounts.import_account_from_private_key(alias, passphrase, key)


def deploy_mocks():
    print(f"The active network is {networks.active_provider.network.name}")
    if len(MockV3Aggregator) <= 0:
        MockV3Aggregator.deploy(DECIMALS, STARTING_PRICE, sender=get_account())
```

Five transforms:
- Multi-name import rewrite, with `MockV3Aggregator` (PascalCase contract) dropped via TODO
- `network` → `networks` rename in import
- 3× bare `network.show_active()` → `networks.active_provider.network.name` (one inside a multi-line `if`, one inside an f-string)
- `accounts.add(...)` flagged with inline TODO at safe context (assignment RHS)
- 1× tx-dict → kwargs (`get_account()` call inside dict value preserved correctly)

---

## Example 3 — Tx-dict with trailing kwarg (preserves arg order)

**File:** [`scripts/deploy.py`](https://github.com/PatrickAlphaC/brownie_fund_me/blob/main/scripts/deploy.py) (brownie_fund_me)

**Brownie:**
```python
fund_me = FundMe.deploy(
    price_feed_address,
    {"from": account},
    publish_source=config["networks"][network.show_active()].get("verify"),
)
```

**After codemod:**
```python
fund_me = FundMe.deploy(
    price_feed_address,
    sender=account,
    publish_source=config["networks"][networks.active_provider.network.name].get("verify"),
)
```

This is the case that broke a naive "last-arg-must-be-dict" check. The
`{"from": account}` isn't the last argument syntactically — `publish_source=...`
is. The codemod correctly identifies the dict as the last *positional* arg,
keeps the trailing kwarg, and rewrites `network.show_active()` inside the
trailing kwarg's value.

---

## Example 4 — Exception class rename + import preservation

**File:** [`tests/test_fund_me.py`](https://github.com/PatrickAlphaC/brownie_fund_me/blob/main/tests/test_fund_me.py) (brownie_fund_me)

**Brownie:**
```python
from brownie import network, accounts, exceptions
import pytest

def test_only_owner_can_withdraw():
    if network.show_active() not in LOCAL_BLOCKCHAIN_ENVIRONMENTS:
        pytest.skip("only for local testing")
    fund_me = deploy_fund_me()
    bad_actor = accounts.add()
    with pytest.raises(exceptions.VirtualMachineError):
        fund_me.withdraw({"from": bad_actor})
```

**After codemod:**
```python
from ape import networks, accounts, exceptions
import pytest

def test_only_owner_can_withdraw():
    if networks.active_provider.network.name not in LOCAL_BLOCKCHAIN_ENVIRONMENTS:
        pytest.skip("only for local testing")
    fund_me = deploy_fund_me()
    bad_actor = accounts.add()  # TODO(brownie-to-ape): Ape uses accounts.import_account_from_private_key(alias, passphrase, key)
    with pytest.raises(exceptions.ContractLogicError):
        fund_me.withdraw(sender=bad_actor)
```

The `exceptions` import is *kept* (Ape also has `ape.exceptions`), and the
specific class name is mapped: `VirtualMachineError` → `ContractLogicError`.
Other known mappings: `RPCRequestError` → `RPCError`, `ContractNotFound` →
`ContractNotFoundError`. Unknown exception names trigger a top-of-file TODO
listing the unmapped names so the user knows where to look.

---

## Example 5 — Multi-line `interface.X(...)` with inner show_active rewrite

**File:** [`scripts/aave_borrow.py`](https://github.com/PatrickAlphaC/aave_brownie_py_freecode/blob/main/scripts/aave_borrow.py) (Aave repo)

**Brownie:**
```python
def get_lending_pool():
    lending_pool_addresses_provider = interface.ILendingPoolAddressesProvider(
        config["networks"][network.show_active()]["lending_pool_addresses_provider"]
    )
    lending_pool_address = lending_pool_addresses_provider.getLendingPool()
    lending_pool = interface.ILendingPool(lending_pool_address)
    return lending_pool
```

**After codemod:**
```python
def get_lending_pool():
    lending_pool_addresses_provider = interface.ILendingPoolAddressesProvider(
        config["networks"][networks.active_provider.network.name]["lending_pool_addresses_provider"]
    )  # TODO(brownie-to-ape): interface.X(addr) -> Ape's Contract(addr) with explicit ABI/type loaded via project
    lending_pool_address = lending_pool_addresses_provider.getLendingPool()
    lending_pool = interface.ILendingPool(lending_pool_address)  # TODO(brownie-to-ape): interface.X(addr) -> Ape's Contract(addr) with explicit ABI/type loaded via project
    return lending_pool
```

Two passes compose cleanly here:
- Pass 2b (`network.show_active()` → `networks.active_provider.network.name`) fires on the inner subscript expression
- Pass 10 (interface inline TODO) fires on the outer `interface.X(...)` call by replacing only the closing `)` token (not the full call text), avoiding the edit-overlap that would clobber Pass 2b's work

This was an actual regression we caught in Phase 4 of development — the
original Pass 10 implementation replaced the entire call text and clobbered
the inner show_active rewrite. The closing-paren-only replacement strategy
is what makes multi-pass composition work.

---

## Example 6 — Brownie's `isolate` fixture flagged for removal

**File:** [`tests/conftest.py`](https://github.com/brownie-mix/token-mix/blob/master/tests/conftest.py) (token-mix)

**Brownie:**
```python
import pytest


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    # perform a chain rewind after completing each test, to ensure proper isolation
    pass


@pytest.fixture(scope="module")
def token(Token, accounts):
    return Token.deploy("Test Token", "TST", 18, 1e21, {'from': accounts[0]})
```

**After codemod:**
```python
import pytest


# TODO(brownie-to-ape): Ape has built-in per-test chain isolation via chain.isolate(). This fixture can be removed.
@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    # perform a chain rewind after completing each test, to ensure proper isolation
    pass


@pytest.fixture(scope="module")
def token(Token, accounts):
    return Token.deploy("Test Token", "TST", 18, 1e21, sender=accounts[0])
```

The codemod inspects the function body. If it's just `pass` (with optional
docstring/comments), the TODO fires. **User-customized isolate fixtures**
with real logic (e.g. `chain.snapshot(); yield; chain.revert()`) are left
alone — body inspection prevents that false positive (covered by test 33).

The conftest.py file doesn't directly `from brownie import …`, but it
contains the substring "brownie" in a docstring URL — so the file-marker
check still picks it up and the tx-dict in the `token` fixture below gets
rewritten too.

---

## What the user sees on stdout

```
$ npx codemod@latest workflow run -w workflow.yaml --target /tmp/token-mix --no-interactive --allow-dirty
💥 Workflow started with ID: a2d0d9d2-e18d-4854-a637-793a9529596b
⏺ Apply Brownie -> Ape transforms to Python files
✅ Workflow completed successfully in 3.0s
✨ Done in 3.021s
```

Three seconds for a complete repo migration. See [scripts/benchmark.sh](./scripts/benchmark.sh)
for the full benchmark across four repos and [benchmark/results.md](./benchmark/results.md)
for the latest numbers.
