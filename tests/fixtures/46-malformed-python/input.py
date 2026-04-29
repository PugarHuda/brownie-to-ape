from brownie import accounts


def broken(:
    # Intentionally malformed — codemod should not crash, just return null
    return contract.deploy({"from": accounts[0]})
