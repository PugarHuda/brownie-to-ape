from brownie import accounts, config


def deploy(account):
    fund_me = FundMe.deploy(
        price_feed_address,
        {"from": account},
        publish_source=config["networks"]["mainnet"].get("verify"),
    )
    return fund_me
