import pytest
from ape import accounts


# TODO(brownie-to-ape): Ape has built-in per-test chain isolation via chain.isolate(). This fixture can be removed.
@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    pass


@pytest.fixture(scope="module")
def deployer():
    return accounts[0]
