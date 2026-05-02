from brownie import exceptions
import pytest


def test_rpc():
    with pytest.raises(exceptions.RPCRequestError):
        do_thing()
