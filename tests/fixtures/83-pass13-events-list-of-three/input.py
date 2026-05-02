from brownie import accounts


def test_multiple_events(tx):
    a = tx.events[0]["fee"]
    b = tx.events[1]["amount"]
    c = tx.events[2]["sender"]
    return a, b, c
