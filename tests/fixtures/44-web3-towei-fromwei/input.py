from brownie import accounts
from web3 import Web3


def setup():
    amount = Web3.toWei(0.1, "ether")
    readable = Web3.fromWei(amount, "ether")
    return amount, readable
