from brownie import accounts, chain


def fund(contract, sender, recipient, amount):
    tx = contract.transfer(recipient, amount, {"from": sender, "value": 1000, "gas_limit": 200000})
    return tx
