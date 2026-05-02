from functools import partial
from brownie import accounts


def my_helper(data):
    return data


# functools.partial — second arg is a dict, must stay as dict (partial
# expects positional args of the wrapped function, kwargs would change
# semantics).
deferred = partial(my_helper, {"from": "alice", "value": 100})
