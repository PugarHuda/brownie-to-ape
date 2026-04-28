from brownie import accounts


def deploy_simple(deployer):
    return Empty.deploy({"from": deployer})
