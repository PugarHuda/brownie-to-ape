import ape

# Deeply nested attribute access through brownie should still rewrite
# the brownie root only, not over-rewrite intermediate names.
result = ape.project.load(".").get_contract("Token").at("0x0")
balance = ape.accounts[0].balance() // 10
chain_id = ape.chain.id
