from ape import accounts, exceptions
import pytest


def test_revert(token):
    with pytest.raises(exceptions.ContractLogicError):
        token.transfer(accounts[0], 1, sender=accounts[1])
