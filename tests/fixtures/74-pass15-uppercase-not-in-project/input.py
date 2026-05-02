from ape import chain
import enum


class Status(enum.Enum):
    PENDING = 1
    DONE = 2


def get_first():
    # `Status` is uppercase but file does NOT have `from ape import project`.
    # Pass 15 must NOT fire — heuristic requires the project import.
    return Status[-1]
