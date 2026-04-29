from ape import accounts


def broken(:
    # Intentionally malformed — codemod should not crash, just return null
    return contract.deploy(sender=accounts[0])
