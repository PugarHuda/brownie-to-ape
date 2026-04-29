# TODO(brownie-to-ape): no direct Ape equivalent for: SimpleStorage
from ape import accounts, project


def main():
    account = accounts[0]
    return project.SimpleStorage.deployments[-1], account
