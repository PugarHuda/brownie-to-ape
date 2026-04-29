from ape import accounts


def test_event(tx):
    subscription_id = tx.events[0].event_arguments["subId"]
    assert subscription_id > 0
