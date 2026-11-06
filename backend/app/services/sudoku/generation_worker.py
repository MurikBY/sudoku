import os

from app.services.sudoku.difficulty import Difficulty
from app.services.sudoku.puzzle import GeneratedPuzzle, generate_puzzle


class GenerationFailed(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)


def initialize_worker() -> None:
    # Keep generation off the API process's CPU.
    os.nice(10)


def warm_up() -> None:
    # Submitting this starts the worker, which imports the engine with this module.
    pass


def generate_in_worker(difficulty: Difficulty) -> GeneratedPuzzle:
    try:
        return generate_puzzle(difficulty)
    except RuntimeError as error:
        raise GenerationFailed(str(error)) from error
