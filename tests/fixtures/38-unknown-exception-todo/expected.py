from ape import exceptions
import pytest


# TODO(brownie-to-ape): exceptions.{SomeUnknownExc} have no known Ape mapping — Ape's exception class names differ. See https://docs.apeworx.io/ape/stable/methoddocs/exceptions.html
def test_thing():
    with pytest.raises(exceptions.SomeUnknownExc):
        do_something()
