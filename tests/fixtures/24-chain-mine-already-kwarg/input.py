from brownie import chain


def mine_blocks():
    # Already a kwarg — leave alone (don't double-transform).
    chain.mine(num_blocks=5)
    # No args — leave alone (default behavior is the same).
    chain.mine()
