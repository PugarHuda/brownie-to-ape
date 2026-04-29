# TODO(brownie-to-ape): no direct Ape equivalent for: Wei
from ape import accounts


def get_amount():
    amount = Wei("1 ether")  # TODO(brownie-to-ape): Wei("X") -> from ape.utils import convert; convert("X", int)
    fee = Wei("100 gwei")  # TODO(brownie-to-ape): Wei("X") -> from ape.utils import convert; convert("X", int)
    return amount, fee
