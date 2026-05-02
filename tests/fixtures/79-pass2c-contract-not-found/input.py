from brownie import exceptions
import pytest


def test_missing():
    with pytest.raises(exceptions.ContractNotFound):
        Token.load("nonexistent")
