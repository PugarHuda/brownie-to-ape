import brownie


def test_revert():
    with brownie.reverts("oops"):
        do_thing()
