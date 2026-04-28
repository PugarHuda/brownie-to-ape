from ape import accounts


def deploy_token(deployer):
    token = Token.deploy("MyToken", "MTK", 18, sender=deployer)
    return token
