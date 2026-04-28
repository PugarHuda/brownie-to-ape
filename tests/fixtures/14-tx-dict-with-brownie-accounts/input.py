def setup():
    return Token.deploy("X", {"from": brownie.accounts[0]})
