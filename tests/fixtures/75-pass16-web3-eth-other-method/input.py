from brownie import web3


def fetch_block(num):
    # Pass 16 only rewrites web3.eth.get_balance — other methods on
    # web3.eth must stay untouched.
    return web3.eth.get_block(num)
