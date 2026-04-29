# File mentions "brownie" only inside a docstring/string. There's no
# brownie import, no brownie.X access, no tx-dict. Codemod's
# substring early-exit lets the file through, but no transform pass
# should fire — output must equal input.

description = "We used to use brownie to deploy contracts."
LEGACY_NOTE = "TODO: this used brownie's network helpers — port later."


def hello():
    return {"from": "alice", "value": 100}  # not a tx-dict (no method call)
