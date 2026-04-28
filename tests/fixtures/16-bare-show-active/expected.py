from ape import networks, config

LOCAL = ["development"]


def get_env():
    if networks.active_provider.network.name in LOCAL:
        return "local"
    return config["networks"][networks.active_provider.network.name]
