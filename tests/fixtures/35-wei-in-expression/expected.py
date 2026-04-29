# TODO(brownie-to-ape): no direct Ape equivalent for: Wei
from ape import accounts


from ape.utils import convert
def safe_amount():
    # In a complex expression — adding trailing comment would break.
    if convert("1 ether", int) < some_threshold:
        return None
    return [convert("1 ether", int), convert("2 ether", int)]
