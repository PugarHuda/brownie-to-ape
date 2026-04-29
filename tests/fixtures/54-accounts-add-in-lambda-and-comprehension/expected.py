from ape import accounts


# Lambda body — `accounts.add` is inside a `lambda` node, not an
# expression_statement or assignment. Codemod must NOT inject inline TODO.
adder = lambda pk: accounts.add(pk)


# List comprehension — element expression. Same guard.
def setup(private_keys):
    return [accounts.add(pk) for pk in private_keys]
