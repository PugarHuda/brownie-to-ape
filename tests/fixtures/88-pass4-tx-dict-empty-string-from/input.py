from brownie import accounts

# Empty string for "from" — uncommon but legal Python; codemod still
# rewrites correctly (the sender= keyword is value-agnostic).
tx = Token.deploy({"from": ""})
