# TODO(brownie-to-ape): no direct Ape equivalent for: Wei
from ape import accounts
from ape.utils import convert


def get_amount():
    return convert("1 ether", int)
