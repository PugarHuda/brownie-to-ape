from web3 import Web3


# File does NOT have `from brownie import web3` — Pass 16 guard requires it.
# Codemod must NOT rewrite `web3.eth.get_balance` here.
balance = Web3.eth.get_balance(addr)
