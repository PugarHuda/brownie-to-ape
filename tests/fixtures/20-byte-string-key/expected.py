from ape import accounts


def weird_call(deployer):
    # b-string keys are NOT typical Brownie tx-dicts. Don't transform.
    return some_func({b"from": deployer})
