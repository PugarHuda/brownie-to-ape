from brownie import accounts

# tx-dict with inline comments — make sure rewrite doesn't break on the comment.
# Current codemod behavior: does NOT auto-rewrite when an inline comment
# follows the tx-dict — preserves source verbatim to avoid mangling
# comments. This is a documented FN; manual cleanup needed.
tx = Token.deploy(
    "Test",
    {"from": accounts[0]},  # deployer
)
