from ape import accounts


def deploy_simple(deployer):
    return Empty.deploy(sender=deployer)
