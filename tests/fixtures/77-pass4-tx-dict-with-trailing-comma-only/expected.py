from ape import accounts


def deploy(c, acct):
    # Single-key tx-dict with trailing comma — Python valid; Pass 4
    # must still produce clean kwarg syntax (no trailing comma artifact).
    return c.deploy(sender=acct)
