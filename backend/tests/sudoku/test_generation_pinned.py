import random

import pytest

from app.services.sudoku.carver import carve_puzzle
from app.services.sudoku.generator import generate_complete_grid
from app.services.sudoku.puzzle import generate_puzzle

COMPLETE_GRID_SEED_3 = (
    "267835149195624873834791625456173982983462751712958364379246518528317496641589237"
)
CARVED_MIN_GIVENS_30_SEED_5 = (
    "060800109095024003004000605450073000000000000702950000079046500000017000001000230"
)
EASY_PUZZLE_SEED_7 = (
    "078000001500007406000100800600030000100000609090010370780001000001003705065908002"
)
EASY_SOLUTION_SEED_7 = (
    "278364591519827436436195827657439218143782659892516374784251963921643785365978142"
)
MEDIUM_PUZZLE_SEED_7 = (
    "208064001500000036400000800007039000000080609890010070000051060000000705060070142"
)
# Same complete grid as easy: both searches start from Random(7).
MEDIUM_SOLUTION_SEED_7 = (
    "278364591519827436436195827657439218143782659892516374784251963921643785365978142"
)
HARD_PUZZLE_SEED_1 = (
    "000005010000009270003407060009060024000500000060004001800096000430000002100300000"
)
HARD_SOLUTION_SEED_1 = (
    "678235419541689273923417865719863524284571936365924781852196347436758192197342658"
)

_GENERATE_ATTEMPTS = 80
_GENERATE_SECONDS = 900


def test_generate_complete_grid_seed_3_is_pinned():
    assert generate_complete_grid(random.Random(3)) == COMPLETE_GRID_SEED_3


def test_carve_min_givens_30_seed_5_is_pinned():
    carved = carve_puzzle(COMPLETE_GRID_SEED_3, random.Random(5), min_givens=30)
    assert carved == CARVED_MIN_GIVENS_30_SEED_5


@pytest.mark.slow
@pytest.mark.parametrize(
    ("difficulty", "seed", "puzzle", "solution"),
    [
        pytest.param("easy", 7, EASY_PUZZLE_SEED_7, EASY_SOLUTION_SEED_7, id="easy"),
        pytest.param("medium", 7, MEDIUM_PUZZLE_SEED_7, MEDIUM_SOLUTION_SEED_7, id="medium"),
        pytest.param("hard", 1, HARD_PUZZLE_SEED_1, HARD_SOLUTION_SEED_1, id="hard"),
    ],
)
def test_generate_puzzle_is_pinned(difficulty, seed, puzzle, solution):
    generated = generate_puzzle(
        difficulty,
        rng=random.Random(seed),
        max_attempts=_GENERATE_ATTEMPTS,
        max_generate_seconds=_GENERATE_SECONDS,
    )
    assert generated.puzzle == puzzle
    assert generated.solution == solution
