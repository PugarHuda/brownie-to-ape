from brownie import ZERO_ADDRESS, accounts


def is_zero(addr):
    return addr == ZERO_ADDRESS
