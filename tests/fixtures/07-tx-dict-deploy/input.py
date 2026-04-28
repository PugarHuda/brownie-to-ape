from brownie import accounts


def deploy_token(deployer):
    token = Token.deploy("MyToken", "MTK", 18, {"from": deployer})
    return token
