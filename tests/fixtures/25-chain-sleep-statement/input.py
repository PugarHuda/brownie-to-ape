from brownie import chain


def fast_forward():
    chain.sleep(60)
    chain.sleep(86400)
