from brownie import accounts


def helper(opts):
    # User helper that wraps a contract call. The dict is meant to STAY
    # a dict because helper passes it through to the contract method.
    return contract.transfer(opts)


# Module-level function call (not a method). Must NOT be transformed —
# helper expects a dict, not kwargs.
result = helper({"from": "alice", "value": 100})
