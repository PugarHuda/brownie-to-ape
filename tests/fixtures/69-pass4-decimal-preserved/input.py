from decimal import Decimal
from brownie import accounts


def precision_value(c, acct):
    # Decimal expression preserved exactly — codemod is text-level for values.
    return c.f(arg, {"from": acct, "value": Decimal("0.000000000000000001")})
