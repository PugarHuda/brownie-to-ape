import brownie
import pytest


def test_revert(token, deployer):
    with pytest.raises(brownie.exceptions.VirtualMachineError):
        token.transfer(deployer, 1, {"from": deployer})
