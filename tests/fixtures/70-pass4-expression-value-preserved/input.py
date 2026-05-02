from brownie import accounts


def computed_value(c, acct, balance):
    # Inline arithmetic preserved as expression — codemod doesn't evaluate.
    return c.f(arg, {"from": acct, "value": 0.1 * 10 ** 18})
