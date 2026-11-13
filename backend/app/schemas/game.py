import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models.enums import Difficulty, GameStatus
from app.schemas.preferences import GameAssistsPayload
from app.schemas.strict_request import StrictRequest
from app.services.sudoku.coach_step import NotesIssueKind
from app.services.sudoku.grid import HouseKind
from app.services.sudoku.lessons.models import NotesIssuePayload, TechniqueStepPayload
from app.services.sudoku.lessons.role import LessonRole
from app.services.sudoku.technique import Technique

MAX_ELAPSED_SECONDS = 7 * 24 * 3600
ElapsedSeconds = Annotated[int, Field(ge=0, le=MAX_ELAPSED_SECONDS)]


class CreateGameRequest(StrictRequest):
    difficulty: Difficulty


class SyncGameRequest(StrictRequest):
    elapsed_seconds: ElapsedSeconds


class MoveCellRequest(StrictRequest):
    value: int = Field(ge=0, le=9)
    elapsed_seconds: ElapsedSeconds | None = None


class CompleteGameRequest(StrictRequest):
    elapsed_seconds: ElapsedSeconds


class AbandonGameRequest(StrictRequest):
    elapsed_seconds: ElapsedSeconds


class HintRequest(StrictRequest):
    elapsed_seconds: ElapsedSeconds | None = None


class CellNotesRequest(StrictRequest):
    digits: list[int] = Field(default_factory=list)
    elapsed_seconds: ElapsedSeconds | None = None


class UndoMoveRequest(StrictRequest):
    elapsed_seconds: ElapsedSeconds | None = None


class CompletionRecap(BaseModel):
    clean: bool
    your_avg_clean_seconds: int | None
    global_avg_clean_seconds: int | None
    rating_rank: int | None
    previous_rating_rank: int | None


class GameResponse(BaseModel):
    id: uuid.UUID
    difficulty: Difficulty
    status: GameStatus
    puzzle: str
    current_grid: str
    mistakes_count: int
    hints_count: int
    pencil_count: int
    notes: dict[str, list[int]]
    elapsed_seconds: int
    started_at: datetime
    completed_at: datetime | None
    party_id: uuid.UUID | None = None
    assists: GameAssistsPayload
    share_code: str
    is_analysis: bool = False
    analysis_source_game_id: uuid.UUID | None = None
    is_lesson: bool = False
    lesson_technique: str | None = None
    lesson_position_id: str | None = None
    lesson_role: LessonRole | None = None
    lesson_has_practice: bool | None = None
    lesson_objective_met: bool | None = None
    lesson_step: TechniqueStepPayload | None = None
    lesson_notes_issue: NotesIssuePayload | None = None
    conflict_indices: list[int]
    wrong_digit_indices: list[int]
    undo_count: int
    completion: CompletionRecap | None = None


class MoveCellResponse(GameResponse):
    is_mistake: bool


class UndoMoveResponse(GameResponse):
    flashed_cell_indices: list[int]
    undone_cell_index: int


class HintResponse(GameResponse):
    kind: Literal["mistake", "notes", "technique"]
    error_indices: list[int]
    technique: Technique | None
    house: HouseKind | None
    house_index: int | None
    outline_cells: list[int]
    focus_cells: list[int]
    elim_cells: list[int]
    digit: int | None
    digits: list[int]
    notes_issue: NotesIssueKind | None


class GameHistoryItem(BaseModel):
    id: uuid.UUID
    share_code: str
    difficulty: Difficulty
    status: GameStatus
    started_at: datetime
    completed_at: datetime | None
    elapsed_seconds: int
    mistakes_count: int
    hints_count: int
    pencil_count: int
    party_id: uuid.UUID | None
    is_party: bool
    display_name: str
    replay_available: bool


class GameHistoryResponse(BaseModel):
    items: list[GameHistoryItem]
    total: int


GameEventKind = Literal["set", "clear", "notes", "hint"]


class GameEvent(BaseModel):
    kind: GameEventKind
    cell: int | None = None
    value: int | None = None
    notes: list[int] | None = None
    peer_notes: dict[str, list[int]] | None = None


class GameReviewResponse(BaseModel):
    id: uuid.UUID
    share_code: str
    difficulty: Difficulty
    status: GameStatus
    puzzle: str
    solution: str
    started_at: datetime
    completed_at: datetime | None
    elapsed_seconds: int
    mistakes_count: int
    hints_count: int
    pencil_count: int
    party_id: uuid.UUID | None
    is_party: bool
    display_name: str
    assists: GameAssistsPayload
    events: list[GameEvent]
    replay_available: bool
    play_from_here_available: bool


class CreateAnalysisGameRequest(StrictRequest):
    share_code: str = Field(min_length=4, max_length=8)
    event_index: int = Field(ge=0)


class CreateLessonGameRequest(StrictRequest):
    technique: str
    variant: LessonRole
    exclude_position_id: str | None = None


class TaughtLessonSnapshotResponse(BaseModel):
    technique: str
    position_id: str
    grid: str
    notes: dict[str, list[int]]
    has_practice: bool
    step: TechniqueStepPayload | None
    notes_issue: NotesIssuePayload | None


class LessonTechniqueProgress(BaseModel):
    technique: str
    pool_size: int
    solved_count: int


class LessonProgressResponse(BaseModel):
    items: list[LessonTechniqueProgress]


class PuzzleExportRequest(StrictRequest):
    format: str = Field(pattern=r"^sudoku-export-v1$")
    share_code: str = Field(min_length=4, max_length=8)
    difficulty: Difficulty
    puzzle: str = Field(min_length=81, max_length=81)
    grid: str = Field(min_length=81, max_length=81)
    notes: dict[str, list[int]]
    board: str = Field(min_length=1)
