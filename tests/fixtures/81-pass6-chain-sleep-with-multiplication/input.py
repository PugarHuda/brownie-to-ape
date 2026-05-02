from brownie import chain


def advance_one_day():
    # Expression as arg — preserved exactly in kwarg-style rewrite.
    chain.sleep(60 * 60 * 24)
