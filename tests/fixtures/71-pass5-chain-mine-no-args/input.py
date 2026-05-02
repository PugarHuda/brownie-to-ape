from brownie import chain


def advance():
    # No-arg chain.mine() — semantically same in Brownie & Ape (mine 1 block).
    # Pass 5 must NOT inject num_blocks=undefined or anything similar.
    chain.mine()
