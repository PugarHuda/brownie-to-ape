import pytest
from brownie import Contract, accounts, chain


@pytest.fixture(scope="module")
def deployer():
    return accounts[0]


@pytest.fixture(scope="module")
def token(Token, deployer):
    return Token.deploy("Test", "TST", 18, {"from": deployer})


@pytest.fixture
def fund_user(token, deployer):
    def _fund(user, amount):
        token.transfer(user, amount, {"from": deployer})
    return _fund
