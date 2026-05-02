import brownie

# Deeply nested attribute access through brownie should still rewrite
# the brownie root only, not over-rewrite intermediate names.
result = brownie.project.load(".").get_contract("Token").at("0x0")
balance = brownie.accounts[0].balance() // 10
chain_id = brownie.chain.id
