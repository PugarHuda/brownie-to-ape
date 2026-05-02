from ape import accounts


def deploy_with_meta(c, acct):
    # Dict has "from" but ALSO contains "name" — which isn't a tx-dict key.
    # Pass 4 must abort: presence of unknown key signals this isn't a
    # tx-dict, just a regular dict that happens to share key names.
    return c.deploy(acct, {"from": acct, "name": "MyContract", "value": 100})
