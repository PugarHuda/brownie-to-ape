from ape import accounts


def transfer(token, addr, amount, acct):
    return token.transfer(addr, amount, sender=acct, value=100, gas_limit=200000)
