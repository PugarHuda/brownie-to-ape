from brownie import accounts


def deploy_with_value():
    # Scientific notation MUST be preserved exactly — no eager int conversion.
    return Token.deploy(arg, {"from": accounts[0], "value": 1e18})
