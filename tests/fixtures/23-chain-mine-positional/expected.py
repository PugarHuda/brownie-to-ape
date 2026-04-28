from ape import chain


def mine_blocks():
    chain.mine(num_blocks=10)
    chain.mine(num_blocks=100)
