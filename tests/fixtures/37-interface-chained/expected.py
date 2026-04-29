# TODO(brownie-to-ape): no direct Ape equivalent for: interface
from ape import accounts


def get_balance(addr, account):
    # Chained call — appending trailing comment would break the chain.
    return interface.IERC20(addr).balanceOf(account)
