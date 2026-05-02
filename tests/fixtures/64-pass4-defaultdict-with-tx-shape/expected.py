from collections import defaultdict
from ape import accounts


# defaultdict is a dict factory — never a Brownie contract method.
def_config = defaultdict(int, {"from": "alice", "value": 100})
