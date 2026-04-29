from brownie import web3

amount = web3.toWei(1, "ether")
balance = web3.eth.get_balance(account)
