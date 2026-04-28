from brownie import network, config

LOCAL = ["development"]


def get_env():
    if network.show_active() in LOCAL:
        return "local"
    return config["networks"][network.show_active()]
