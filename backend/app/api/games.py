import uuid

from aiogram import Bot
from fastapi import APIRouter, Depends, Query, Response

from app.api.deps import CurrentUser, DbSession, PlayLockHeader, get_bot
from app.models.enums import Difficulty, GameStatus
from app.schemas.game import (
    AbandonGameRequest,
    CellNotesRequest,
    CompleteGameRequest,
    CreateAnalysisGameRequest,
    CreateGameRequest,
    CreateLessonGameRequest,
    GameHistoryResponse,
    GameResponse,
    GameReviewResponse,
    HintRequest,
    HintResponse,
    LessonProgressResponse,
    MoveCellRequest,
    MoveCellResponse,
    PuzzleExportRequest,
    SyncGameRequest,
    TaughtLessonSnapshotResponse,
    UndoMoveRequest,
    UndoMoveResponse,
)
from app.schemas.mappers import (
    game_history_item,
    game_response,
    game_review_response,
    hint_result_to_response,
    lesson_progress_response,
    move_result_to_response,
    taught_lesson_response,
    undo_result_to_response,
)
from app.services.game_completion_notify import schedule_completion_notices
from app.services.games import analysis, creation, lessons, lifecycle, queries, review, undo
from app.services.games.coach_hint import apply_coach_hint
from app.services.games.moves import CellMove, apply_move
from app.services.games.notes import apply_notes
from app.services.lesson_progress_service import progress_for_user
from app.services.play_lock_service import require_play_lock_allows
from app.services.puzzle_export import send_puzzle_export_to_chat

router = APIRouter(prefix="/api/games", tags=["games"])


@router.post("", response_model=GameResponse, status_code=201)
async def create_game(
    body: CreateGameRequest,
    current_user: CurrentUser,
    session: DbSession,
    x_play_lock_token: PlayLockHeader = None,
) -> GameResponse:
    await require_play_lock_allows(session, current_user, x_play_lock_token)
    game = await creation.create_game(session, current_user, body.difficulty)
    return await game_response(session, game)


@router.get("/resumable", response_model=GameResponse | None)
async def get_resumable_game(
    current_user: CurrentUser,
    session: DbSession,
) -> GameResponse | None:
    game = await queries.get_resumable_game(session, current_user.id)
    if game is None:
        return None
    return await game_response(session, game)


@router.get("/history", response_model=GameHistoryResponse)
async def list_game_history(
    current_user: CurrentUser,
    session: DbSession,
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    difficulty: Difficulty | None = Query(default=None),
    status: GameStatus | None = Query(default=None),
) -> GameHistoryResponse:
    entries, total = await queries.list_finished_game_history(
        session,
        current_user.id,
        limit,
        offset,
        difficulty,
        status,
    )
    return GameHistoryResponse(
        items=[game_history_item(entry) for entry in entries],
        total=total,
    )


@router.get("/by-code/{code}", response_model=GameReviewResponse)
async def get_game_review_by_code(
    code: str,
    current_user: CurrentUser,
    session: DbSession,
) -> GameReviewResponse:
    game_review = await review.get_game_review_by_code(session, code)
    return game_review_response(game_review, viewer_user_id=current_user.id)


@router.post("/export-to-chat", status_code=204)
async def export_puzzle_to_chat(
    body: PuzzleExportRequest,
    current_user: CurrentUser,
    session: DbSession,
    bot: Bot | None = Depends(get_bot),
) -> Response:
    await send_puzzle_export_to_chat(bot, session, current_user.id, body)
    return Response(status_code=204)


@router.post("/analysis", response_model=GameResponse, status_code=201)
async def create_analysis_game(
    body: CreateAnalysisGameRequest,
    current_user: CurrentUser,
    session: DbSession,
    x_play_lock_token: PlayLockHeader = None,
) -> GameResponse:
    await require_play_lock_allows(session, current_user, x_play_lock_token)
    game = await analysis.create_analysis_game(
        session,
        current_user,
        body.share_code,
        body.event_index,
    )
    return await game_response(session, game)


@router.post("/lessons", response_model=GameResponse, status_code=201)
async def create_lesson_game(
    body: CreateLessonGameRequest,
    current_user: CurrentUser,
    session: DbSession,
    x_play_lock_token: PlayLockHeader = None,
) -> GameResponse:
    await require_play_lock_allows(session, current_user, x_play_lock_token)
    game = await lessons.create_lesson_game(
        session,
        current_user,
        body.technique,
        body.variant,
        body.exclude_position_id,
    )
    return await game_response(session, game)


@router.get("/lesson-progress", response_model=LessonProgressResponse)
async def get_lesson_progress(
    current_user: CurrentUser,
    session: DbSession,
) -> LessonProgressResponse:
    items = await progress_for_user(session, current_user.id)
    return lesson_progress_response(items)


@router.get("/lessons/{technique}", response_model=TaughtLessonSnapshotResponse)
async def get_taught_lesson_snapshot(
    technique: str,
    _current_user: CurrentUser,
) -> TaughtLessonSnapshotResponse:
    lesson = lessons.get_taught_lesson(technique)
    return taught_lesson_response(lesson)


@router.get("/{game_id}/review", response_model=GameReviewResponse)
async def get_game_review(
    game_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> GameReviewResponse:
    game_review = await review.get_game_review_for_owner(
        session,
        current_user.id,
        game_id,
    )
    return game_review_response(game_review, viewer_user_id=current_user.id)


@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: uuid.UUID,
    current_user: CurrentUser,
    session: DbSession,
) -> GameResponse:
    game = await queries.get_game(session, current_user.id, game_id)
    return await game_response(session, game)


@router.patch("/{game_id}", response_model=GameResponse)
async def sync_game_progress(
    game_id: uuid.UUID,
    body: SyncGameRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> GameResponse:
    game = await lifecycle.sync_elapsed_seconds(
        session,
        current_user.id,
        game_id,
        body.elapsed_seconds,
    )
    return await game_response(session, game)


@router.put("/{game_id}/cells/{index}", response_model=MoveCellResponse)
async def move_cell(
    game_id: uuid.UUID,
    index: int,
    body: MoveCellRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> MoveCellResponse:
    move_result = await apply_move(
        session,
        current_user.id,
        game_id,
        CellMove(
            index=index,
            value=body.value,
        ),
        body.elapsed_seconds,
    )
    return await move_result_to_response(session, move_result)


@router.put("/{game_id}/cells/{index}/notes", response_model=GameResponse)
async def set_cell_notes(
    game_id: uuid.UUID,
    index: int,
    body: CellNotesRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> GameResponse:
    game = await apply_notes(
        session,
        current_user.id,
        game_id,
        index,
        body.digits,
        body.elapsed_seconds,
    )
    return await game_response(session, game)


@router.post("/{game_id}/undo", response_model=UndoMoveResponse)
async def undo_last_move(
    game_id: uuid.UUID,
    body: UndoMoveRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> UndoMoveResponse:
    undo_result = await undo.undo_last_move(
        session,
        current_user.id,
        game_id,
        body.elapsed_seconds,
    )
    return await undo_result_to_response(session, undo_result)


@router.post("/{game_id}/hint", response_model=HintResponse)
async def apply_hint(
    game_id: uuid.UUID,
    body: HintRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> HintResponse:
    hint_result = await apply_coach_hint(
        session,
        current_user.id,
        game_id,
        body.elapsed_seconds,
    )
    return await hint_result_to_response(session, hint_result)


@router.post("/{game_id}/complete", response_model=GameResponse)
async def complete_game(
    game_id: uuid.UUID,
    body: CompleteGameRequest,
    current_user: CurrentUser,
    session: DbSession,
    bot: Bot | None = Depends(get_bot),
) -> GameResponse:
    game = await lifecycle.complete_game(
        session,
        current_user.id,
        game_id,
        body.elapsed_seconds,
    )
    await schedule_completion_notices(bot, session, game)
    return await game_response(session, game)


@router.post("/{game_id}/abandon", response_model=GameResponse)
async def abandon_game(
    game_id: uuid.UUID,
    body: AbandonGameRequest,
    current_user: CurrentUser,
    session: DbSession,
) -> GameResponse:
    game = await lifecycle.abandon_game(
        session,
        current_user.id,
        game_id,
        body.elapsed_seconds,
    )
    return await game_response(session, game)
