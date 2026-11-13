import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.game import Game
from app.services.games.errors import InvalidHint
from app.services.games.lifecycle import credit_reported_time
from app.services.games.queries import get_game_in_progress
from app.services.sudoku.coach_step import (
    NotesIssue,
    TechniqueStep,
    find_next_notes_issue,
    locate_next_technique_step,
)
from app.services.sudoku.validator import conflict_indices, wrong_digit_indices


@dataclass(frozen=True)
class MistakeHint:
    error_indices: list[int]


@dataclass(frozen=True)
class NotesHint:
    issue: NotesIssue


@dataclass(frozen=True)
class TechniqueHint:
    step: TechniqueStep


CoachHint = MistakeHint | NotesHint | TechniqueHint


@dataclass(frozen=True)
class CoachHintResult:
    game: Game
    hint: CoachHint


def _next_coach_hint(game: Game) -> CoachHint:
    conflicts = sorted(conflict_indices(game.current_grid))
    wrongs = sorted(
        wrong_digit_indices(game.current_grid, game.puzzle, game.solution),
    )
    error_indices = sorted(set(conflicts) | set(wrongs))
    if error_indices:
        return MistakeHint(error_indices=error_indices)
    notes_problem = find_next_notes_issue(game.current_grid, game.notes)
    if notes_problem is not None:
        return NotesHint(issue=notes_problem)
    located = locate_next_technique_step(game.current_grid, game.notes)
    if located is None:
        raise InvalidHint("no coaching step for this board")
    return TechniqueHint(step=located.step)


async def apply_coach_hint(
    session: AsyncSession,
    user_id: int,
    game_id: uuid.UUID,
    elapsed_seconds: int | None,
) -> CoachHintResult:
    game = await get_game_in_progress(session, user_id, game_id, for_update=True)
    hint = _next_coach_hint(game)
    game.hints_count += 1
    credit_reported_time(game, elapsed_seconds)

    await session.commit()
    return CoachHintResult(game=game, hint=hint)
