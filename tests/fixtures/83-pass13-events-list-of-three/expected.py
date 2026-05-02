from ape import accounts


def test_multiple_events(tx):
    a = tx.events[0].event_arguments["fee"]
    b = tx.events[1].event_arguments["amount"]
    c = tx.events[2].event_arguments["sender"]
    return a, b, c
