from ape import exceptions
import pytest


def test_missing():
    with pytest.raises(exceptions.ContractNotFoundError):
        Token.load("nonexistent")
