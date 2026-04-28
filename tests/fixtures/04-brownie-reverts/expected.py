def test_revert(token, acct):
    with ape.reverts("ERC20: insufficient balance"):
        token.transfer(acct, 1000, sender=acct)
