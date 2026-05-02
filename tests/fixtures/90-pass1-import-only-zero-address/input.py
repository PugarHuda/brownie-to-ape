from brownie import ZERO_ADDRESS

# Edge case: only ZERO_ADDRESS imported — the from-line should be
# replaced entirely by `from ape.utils import ZERO_ADDRESS` with no
# residual `from ape import` line.
addr = ZERO_ADDRESS
