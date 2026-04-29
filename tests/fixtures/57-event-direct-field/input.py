from brownie import accounts


def test_event(receipt, receiver):
    assert receipt.events["Transfer"]["to"] == receiver
