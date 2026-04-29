from ape import accounts


def setup():
    new_account = accounts.add()  # TODO(brownie-to-ape): Ape uses accounts.import_account_from_private_key(alias, passphrase, key)
    other = accounts.add(private_key)  # TODO(brownie-to-ape): Ape uses accounts.import_account_from_private_key(alias, passphrase, key)
    return new_account, other
