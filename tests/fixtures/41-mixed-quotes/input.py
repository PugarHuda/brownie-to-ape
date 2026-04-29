from brownie import accounts


def transfer(token, addr, amount, acct):
    return token.transfer(addr, amount, {"from": acct, 'value': 100, "gas_limit": 200000})
