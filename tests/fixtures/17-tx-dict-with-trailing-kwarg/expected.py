from ape import accounts, config


def deploy(account):
    fund_me = FundMe.deploy(
        price_feed_address,
        sender=account,
        publish_source=config["networks"]["mainnet"].get("verify"),
    )
    return fund_me
