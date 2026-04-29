# TODO(brownie-to-ape): no direct Ape equivalent for: Wei
from ape import accounts


from ape.utils import convert
def get_amount():
    amount = convert("1 ether", int)
    fee = convert("100 gwei", int)
    return amount, fee
