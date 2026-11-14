from typing import assert_never

from pydantic import TypeAdapter

from app.models.enums import GameStatus
from app.models.game import Game
from app.schemas.game import (
    CompletionRecap,
    GameEvent,
    GameHistoryItem,
    GameResponse,
    GameReviewResponse,
    HintResponse,
    LessonProgressResponse,
    LessonTechniqueProgress,
    MoveCellResponse,
    TaughtLessonSnapshotResponse,
    UndoMoveResponse,
)
from app.schemas.preferences import GameAssistsPayload
from app.services.games.coach_hint import (
    CoachHintResult,
    MistakeHint,
    NotesHint,
    TechniqueHint,
)
from app.services.games.lessons import TaughtLesson
from app.services.games.moves import MoveResult
from app.services.games.queries import GameHistoryEntry
from app.services.games.review import GameReview
from app.services.games.stored_state import read_events, read_notes
from app.services.games.undo import UndoResult
from app.services.lesson_progress_service import TechniqueProgress
from app.services.sudoku.lessons.runtime import lesson_runtime
from app.services.sudoku.validator import conflict_indices, wrong_digit_indices

_game_event_adapter: TypeAdapter[GameEvent] = TypeAdapter(GameEvent)


def game_response(game: Game, *, completion: CompletionRecap | None) -> GameResponse:
    assists = GameAssistsPayload.model_validate(game.assists)
    notes = read_notes(game.notes)
    lesson_role = None
    lesson_has_practice = None
    lesson_objective_met = None
    lesson_step = None
    lesson_notes_issue = None
    if game.is_lesson:
        if game.lesson_technique is None or game.lesson_position_id is None:
            raise RuntimeError(f"lesson game {game.id} missing technique or position")
        runtime = lesson_runtime(
            game.lesson_technique,
            game.lesson_position_id,
            game.current_grid,
            notes,
        )
        lesson_role = runtime.role
        lesson_has_practice = runtime.has_practice
        lesson_objective_met = runtime.objective_met
        lesson_step = runtime.step
        lesson_notes_issue = runtime.notes_issue
    return GameResponse(
        id=game.id,
        difficulty=game.difficulty,
        status=game.status,
        puzzle=game.puzzle,
        current_grid=game.current_grid,
        mistakes_count=game.mistakes_count,
        hints_count=game.hints_count,
        pencil_count=game.pencil_count,
        notes=notes,
        elapsed_seconds=game.elapsed_seconds,
        started_at=game.started_at,
        completed_at=game.completed_at,
        party_id=game.party_id,
        assists=assists,
        share_code=game.share_code,
        is_analysis=game.is_analysis,
        analysis_source_game_id=game.analysis_source_game_id,
        is_lesson=game.is_lesson,
        lesson_technique=game.lesson_technique,
        lesson_position_id=game.lesson_position_id,
        lesson_role=lesson_role,
        lesson_has_practice=lesson_has_practice,
        lesson_objective_met=lesson_objective_met,
        lesson_step=lesson_step,
        lesson_notes_issue=lesson_notes_issue,
        conflict_indices=sorted(conflict_indices(game.current_grid)),
        wrong_digit_indices=sorted(
            wrong_digit_indices(game.current_grid, game.puzzle, game.solution),
        ),
        undo_count=len(game.undo_stack),
        completion=completion,
    )


def game_review_response(
    review: GameReview,
    *,
    viewer_user_id: int,
) -> GameReviewResponse:
    game = review.game
    assists = GameAssistsPayload.model_validate(game.assists)
    events = [
        _game_event_adapter.validate_python(event.model_dump())
        for event in read_events(game.events)
    ]
    play_from_here_available = (
        game.status != GameStatus.in_progress or game.user_id != viewer_user_id
    )
    return GameReviewResponse(
        id=game.id,
        share_code=game.share_code,
        difficulty=game.difficulty,
        status=game.status,
        puzzle=game.puzzle,
        solution=game.solution,
        started_at=game.started_at,
        completed_at=game.completed_at,
        elapsed_seconds=game.elapsed_seconds,
        mistakes_count=game.mistakes_count,
        hints_count=game.hints_count,
        pencil_count=game.pencil_count,
        party_id=game.party_id,
        is_party=game.party_id is not None,
        display_name=review.display_name,
        assists=assists,
        events=events,
        replay_available=review.replay_available,
        play_from_here_available=play_from_here_available,
    )


def game_history_item(entry: GameHistoryEntry) -> GameHistoryItem:
    return GameHistoryItem(
        id=entry.game.id,
        share_code=entry.game.share_code,
        difficulty=entry.game.difficulty,
        status=entry.game.status,
        started_at=entry.game.started_at,
        completed_at=entry.game.completed_at,
        elapsed_seconds=entry.game.elapsed_seconds,
        mistakes_count=entry.game.mistakes_count,
        hints_count=entry.game.hints_count,
        pencil_count=entry.game.pencil_count,
        party_id=entry.game.party_id,
        is_party=entry.game.party_id is not None,
        display_name=entry.display_name,
        replay_available=bool(entry.game.events),
    )


def taught_lesson_response(lesson: TaughtLesson) -> TaughtLessonSnapshotResponse:
    position = lesson.position
    return TaughtLessonSnapshotResponse(
        technique=position.technique,
        position_id=position.id,
        grid=position.grid,
        notes=position.notes,
        has_practice=lesson.has_practice,
        step=position.step,
        notes_issue=position.notes_issue,
    )


def lesson_progress_response(items: list[TechniqueProgress]) -> LessonProgressResponse:
    return LessonProgressResponse(
        items=[
            LessonTechniqueProgress(
                technique=item.technique,
                pool_size=item.pool_size,
                solved_count=item.solved_count,
            )
            for item in items
        ],
    )


def move_result_to_response(move_result: MoveResult) -> MoveCellResponse:
    game_payload = game_response(move_result.game, completion=None)
    return MoveCellResponse(
        **game_payload.model_dump(),
        is_mistake=move_result.is_mistake,
    )


def undo_result_to_response(undo_result: UndoResult) -> UndoMoveResponse:
    game_payload = game_response(undo_result.game, completion=None)
    return UndoMoveResponse(
        **game_payload.model_dump(),
        flashed_cell_indices=undo_result.flashed_cell_indices,
        undone_cell_index=undo_result.undone_cell_index,
    )


def _mistake_hint_response(game_payload: GameResponse, hint: MistakeHint) -> HintResponse:
    return HintResponse(
        **game_payload.model_dump(),
        kind="mistake",
        error_indices=hint.error_indices,
        technique=None,
        house=None,
        house_index=None,
        outline_cells=[],
        focus_cells=[],
        elim_cells=[],
        digit=None,
        digits=[],
        notes_issue=None,
    )


def _notes_hint_response(game_payload: GameResponse, hint: NotesHint) -> HintResponse:
    issue = hint.issue
    return HintResponse(
        **game_payload.model_dump(),
        kind="notes",
        error_indices=[],
        technique=None,
        house=issue.house.value if issue.house is not None else None,
        house_index=issue.house_index,
        outline_cells=list(issue.outline_cells),
        focus_cells=[issue.cell_index],
        elim_cells=[],
        digit=issue.digit,
        digits=list(issue.digits),
        notes_issue=issue.kind.value,
    )


def _technique_hint_response(game_payload: GameResponse, hint: TechniqueHint) -> HintResponse:
    step = hint.step
    return HintResponse(
        **game_payload.model_dump(),
        kind="technique",
        error_indices=[],
        technique=step.technique.value,
        house=step.house.value if step.house is not None else None,
        house_index=step.house_index,
        outline_cells=list(step.outline_cells),
        focus_cells=list(step.focus_cells),
        elim_cells=list(step.elim_cells),
        digit=step.digit,
        digits=list(step.digits),
        notes_issue=None,
    )


def hint_result_to_response(hint_result: CoachHintResult) -> HintResponse:
    game_payload = game_response(hint_result.game, completion=None)
    hint = hint_result.hint
    match hint:
        case MistakeHint():
            return _mistake_hint_response(game_payload, hint)
        case NotesHint():
            return _notes_hint_response(game_payload, hint)
        case TechniqueHint():
            return _technique_hint_response(game_payload, hint)
        case _:
            assert_never(hint)
