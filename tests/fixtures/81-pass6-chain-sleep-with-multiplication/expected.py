from ape import chain


def advance_one_day():
    # Expression as arg — preserved exactly in kwarg-style rewrite.
    chain.pending_timestamp += 60 * 60 * 24
