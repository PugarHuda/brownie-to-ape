from collections import OrderedDict
from ape import accounts


# OrderedDict is a dict constructor, NOT a Brownie tx-dict — even though
# the dict happens to have keys that look like tx-dict keys.
config = OrderedDict({"from": "alice", "value": 100})
also_config = dict({"from": "bob", "value": 200})
