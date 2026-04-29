from brownie import accounts, exceptions
import pytest


def test_revert(token):
    with pytest.raises(exceptions.VirtualMachineError):
        token.transfer(accounts[0], 1, {"from": accounts[1]})
