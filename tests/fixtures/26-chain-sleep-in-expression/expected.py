from ape import chain


def maybe_sleep():
    # In assignment context, semantics differ — leave alone.
    result = chain.sleep(60)
    # In comparison context — leave alone.
    if chain.sleep(0) is None:
        pass
