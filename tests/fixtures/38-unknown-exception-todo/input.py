from brownie import exceptions
import pytest


def test_thing():
    with pytest.raises(exceptions.SomeUnknownExc):
        do_something()
