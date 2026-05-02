from brownie import chain


def advance():
    # Already kwarg form — Pass 5 must be idempotent (no double-rewrite).
    chain.mine(num_blocks=5)
