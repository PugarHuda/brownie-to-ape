from ape import chain


def fast_forward():
    chain.pending_timestamp += 60
    chain.pending_timestamp += 86400
