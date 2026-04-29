try:
    from ape import accounts, networks
except ImportError:
    accounts = None
    network = None


def show_env():
    if network is not None:
        print(networks.active_provider.network.name)
