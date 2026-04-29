from ape import project
from typing import List


def main(address):
    values: List[int] = []
    latest = SimpleStorage[-1]
    mock_count = len(MockV3Aggregator)
    token = Token.at(address)
    return latest, mock_count, token, values
