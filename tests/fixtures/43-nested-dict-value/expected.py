from ape import accounts


# Nested dict as a tx-dict VALUE — unusual but syntactically valid.
# The codemod just preserves the value text; semantic correctness is
# the user's problem (Brownie wouldn't accept it either).
def call_with_metadata(c, acct, meta):
    return c.method(sender=acct, value=meta)
