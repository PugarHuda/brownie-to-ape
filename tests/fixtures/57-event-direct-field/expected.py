from ape import accounts


def test_event(receipt, receiver):
    assert [log for log in receipt.events if log.event_name == "Transfer"][0].event_arguments["to"] == receiver
