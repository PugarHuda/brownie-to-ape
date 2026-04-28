def test_revert(token, acct):
    with brownie.reverts("ERC20: insufficient balance"):
        token.transfer(acct, 1000, {"from": acct})
