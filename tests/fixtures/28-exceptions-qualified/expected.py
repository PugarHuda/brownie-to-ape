import ape
import pytest


def test_revert(token, deployer):
    with pytest.raises(ape.exceptions.ContractLogicError):
        token.transfer(deployer, 1, sender=deployer)
