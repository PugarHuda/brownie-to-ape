from brownie import accounts


def setup():
    new_account = accounts.add()
    other = accounts.add(private_key)
    return new_account, other
