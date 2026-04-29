from ape import accounts


def is_added():
    # In a complex expression — adding trailing comment would break.
    if accounts.add(pk) is not None:
        return True
    return False
