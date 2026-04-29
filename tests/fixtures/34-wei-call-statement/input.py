from brownie import Wei, accounts


def get_amount():
    amount = Wei("1 ether")
    fee = Wei("100 gwei")
    return amount, fee
