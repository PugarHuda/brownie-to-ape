from brownie import chain


def advance(n):
    # Variable arg — Pass 5 still rewrites positional → kwarg.
    # Variable name preserved exactly.
    chain.mine(n)
