from brownie import exceptions


def test_thing():
    # SomeUnknownExc is not in our mapping — leave alone (user fixes manually)
    raise exceptions.SomeUnknownExc("nope")
