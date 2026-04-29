from ape import accounts
from web3 import Web3


def setup():
    amount = Web3.toWei(0.1, "ether")  # TODO(brownie-to-ape): Web3.toWei(N, "unit") -> from ape.utils import convert; convert(f"{N} unit", int)
    readable = Web3.fromWei(amount, "ether")  # TODO(brownie-to-ape): Web3.fromWei(amt, "unit") -> Decimal(amt) / 10**decimals; or use ape.utils.convert from a string
    return amount, readable
