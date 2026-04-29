from ape import project
from typing import List


def main(address):
    values: List[int] = []
    latest = project.SimpleStorage.deployments[-1]
    mock_count = len(project.MockV3Aggregator.deployments)
    token = project.Token.at(address)
    return latest, mock_count, token, values
