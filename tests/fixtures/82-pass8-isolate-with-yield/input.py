import pytest
from brownie import chain


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    yield
