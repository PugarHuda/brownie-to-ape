from brownie import interface, accounts


def get_token(addr):
    token = interface.IERC20(addr)
    return token
