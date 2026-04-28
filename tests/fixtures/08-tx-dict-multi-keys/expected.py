from ape import accounts, chain


def fund(contract, sender, recipient, amount):
    tx = contract.transfer(recipient, amount, sender=sender, value=1000, gas_limit=200000)
    return tx
