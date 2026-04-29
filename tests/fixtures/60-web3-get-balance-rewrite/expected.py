from brownie import web3  # TODO(brownie-to-ape): migrate this unsupported Brownie import manually.

from ape import chain
amount = web3.toWei(1, "ether")
balance = chain.get_balance(account)
