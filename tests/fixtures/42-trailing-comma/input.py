from brownie import accounts


def transfer(token, addr, amount, acct):
    return token.transfer(addr, amount, {"from": acct,})
