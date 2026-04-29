# TODO(brownie-to-ape): no direct Ape equivalent for: interface
from ape import accounts


def get_token(addr):
    token = interface.IERC20(addr)  # TODO(brownie-to-ape): interface.X(addr) -> Ape's Contract(addr) with explicit ABI/type loaded via project
    return token
