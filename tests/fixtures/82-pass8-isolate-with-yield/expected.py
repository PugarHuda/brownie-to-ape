import pytest
from ape import chain


@pytest.fixture(scope="function", autouse=True)
def isolate(fn_isolation):
    yield
