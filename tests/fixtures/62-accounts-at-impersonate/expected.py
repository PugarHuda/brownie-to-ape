from ape import accounts


def test_whale_action():
    # force=True is Brownie's impersonation idiom — auto-rewrite to Ape's API.
    whale = accounts.impersonate_account("0x1234567890abcdef1234567890abcdef12345678")
    return whale


def test_existing_account():
    # No force=True — just address lookup, NOT impersonation. Leave alone.
    existing = accounts.at("0xfedcba9876543210fedcba9876543210fedcba98")
    return existing
