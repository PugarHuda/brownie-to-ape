from ape import accounts


async def deposit(c, acct, amount):
    # Async/await wrapping of a tx-dict call. Codemod should still
    # rewrite the tx-dict to kwargs — the await wraps the call, and
    # call's parent is `await_expression`, not affecting Pass 4.
    tx = await c.deposit(amount, sender=acct, value=amount)
    return tx
