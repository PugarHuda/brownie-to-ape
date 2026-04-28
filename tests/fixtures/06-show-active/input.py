def main():
    name = brownie.network.show_active()
    print(f"Connected to {name}")
