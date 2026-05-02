from ape import accounts


def all_numeric_formats(c, acct):
    # Codemod must preserve every numeric literal byte-for-byte. No
    # rounding, no normalization, no float coercion mid-transform.
    a = c.f(arg, sender=acct, value=0)
    b = c.f(arg, sender=acct, value=1_000_000_000_000_000_000)
    d = c.f(arg, sender=acct, value=0x1A)
    e = c.f(arg, sender=acct, value=0b10)
    g = c.f(arg, sender=acct, value=0o7)
    h = c.f(arg, sender=acct, value=2 ** 256 - 1)
    return a, b, d, e, g, h
