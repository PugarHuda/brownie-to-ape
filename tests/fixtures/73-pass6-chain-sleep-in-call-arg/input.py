from brownie import chain


def maybe_sleep():
    # chain.sleep INSIDE another call's args (not statement context).
    # Pass 6 must skip — semantics would change if rewritten.
    log_event(chain.sleep(60))
