from ape import exceptions
import pytest


def test_rpc():
    with pytest.raises(exceptions.RPCError):
        do_thing()
