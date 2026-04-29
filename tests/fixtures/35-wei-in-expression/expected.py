# TODO(brownie-to-ape): no direct Ape equivalent for: Wei
from ape import accounts


def safe_amount():
    # In a complex expression — adding trailing comment would break.
    if Wei("1 ether") < some_threshold:
        return None
    return [Wei("1 ether"), Wei("2 ether")]
