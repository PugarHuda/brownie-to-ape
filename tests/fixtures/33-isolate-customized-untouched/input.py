import pytest
from brownie import chain


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    # User-customized isolate — has real logic, leave alone.
    chain.snapshot()
    yield
    chain.revert()
