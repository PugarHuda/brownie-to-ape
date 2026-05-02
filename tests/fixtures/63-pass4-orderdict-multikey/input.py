from collections import OrderedDict
from brownie import accounts


# OrderedDict constructor — even with multi-key tx-shape dict, must NOT
# transform because callee is a dict-like constructor, not a contract method.
config = OrderedDict({"from": "alice", "value": 100, "gas_limit": 200000})
