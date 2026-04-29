try:
    from brownie import accounts, network
except ImportError:
    accounts = None
    network = None


def show_env():
    if network is not None:
        print(network.show_active())
