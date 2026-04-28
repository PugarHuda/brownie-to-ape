balance = brownie.accounts[0].balance()
deployer = brownie.accounts.load("alias")
proj = brownie.project.load(".")
