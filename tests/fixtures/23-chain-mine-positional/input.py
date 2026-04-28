from brownie import chain


def mine_blocks():
    chain.mine(10)
    chain.mine(100)
