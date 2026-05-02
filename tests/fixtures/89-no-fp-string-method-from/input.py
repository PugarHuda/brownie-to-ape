from brownie import accounts

# .from is a method call (not a tx-dict), should NOT be rewritten.
# This is the kind of false-positive we explicitly guard against.
sender = accounts[0]
data = some_dict.from_address(sender)
ok = "from" in {"from": "value"}  # 'from' as string literal — not a tx dict in this context
