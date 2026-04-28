import pytest
# TODO(brownie-to-ape): no direct Ape equivalent for: Contract
from ape import accounts, chain


@pytest.fixture(scope="module")
def deployer():
    return accounts[0]


@pytest.fixture(scope="module")
def token(Token, deployer):
    return Token.deploy("Test", "TST", 18, sender=deployer)


@pytest.fixture
def fund_user(token, deployer):
    def _fund(user, amount):
        token.transfer(user, amount, sender=deployer)
    return _fund
