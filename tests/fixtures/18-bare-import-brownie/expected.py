import ape


def test_revert():
    with ape.reverts("oops"):
        do_thing()
