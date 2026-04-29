from brownie import accounts


def test_event(tx):
    subscription_id = tx.events[0]["subId"]
    assert subscription_id > 0
