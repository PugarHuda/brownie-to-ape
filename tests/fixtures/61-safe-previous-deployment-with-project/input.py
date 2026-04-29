from brownie import SimpleStorage, accounts


def main():
    account = accounts[0]
    return SimpleStorage[-1], account
