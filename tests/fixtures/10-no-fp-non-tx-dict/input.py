# brownie code in same file but this dict is NOT a tx-dict.
from brownie import accounts

config = {"name": "alice", "age": 30}
result = process_user({"first_name": "bob", "last_name": "smith"})
