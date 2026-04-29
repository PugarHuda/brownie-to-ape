import pytest
from brownie import accounts


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    pass


@pytest.fixture(scope="module")
def deployer():
    return accounts[0]
