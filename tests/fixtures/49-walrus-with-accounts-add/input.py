from brownie import accounts


def maybe_add(pk):
    # Walrus operator — accounts.add is inside named_expression, not
    # expression_statement / assignment. Codemod must NOT inject inline
    # TODO comment (would break the walrus syntax).
    if (acc := accounts.add(pk)) is not None:
        return acc
    return None
