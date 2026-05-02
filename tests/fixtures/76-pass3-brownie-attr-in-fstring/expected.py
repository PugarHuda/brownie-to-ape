from ape import accounts


def log_account_info():
    # `brownie.accounts` inside an f-string expression — string template
    # expressions are real expressions and Pass 3 must rewrite them too.
    print(f"first account: {ape.accounts[0]}")
