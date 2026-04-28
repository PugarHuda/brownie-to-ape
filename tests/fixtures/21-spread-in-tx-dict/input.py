from brownie import accounts

DEFAULTS = {"value": 0}


def deploy(deployer):
    # Dict spread (**) in tx-dict is too risky to fold into kwargs — skip.
    return Token.deploy("X", {"from": deployer, **DEFAULTS})
