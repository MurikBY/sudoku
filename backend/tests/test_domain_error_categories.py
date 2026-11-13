from app.api.errors import HTTP_STATUS_BY_ERROR_CATEGORY
from app.services.errors import (
    ConflictError,
    DomainError,
    ForbiddenError,
    InvalidInputError,
    NotFoundError,
    TooManyRequestsError,
    UnavailableError,
)
from app.services.games.errors import (
    ElapsedExceedsGameAge,
    GameLogFull,
    GameNotComplete,
    GameNotFound,
    GameNotInProgress,
    GameReviewUnavailable,
    InvalidHint,
    InvalidMove,
    InvalidNotes,
    LessonPracticeUnavailable,
    LessonTechniqueUnknown,
    UndoUnavailable,
)
from app.services.party.errors import PartyForbidden, PartyFull, PartyNotFound, PartyNotWaiting
from app.services.play_lock_service import PlayLockedError
from app.services.pool_take_limit import PoolTakeRateLimited
from app.services.puzzle_export import PuzzleExportInvalid, PuzzleExportUnavailable
from app.services.puzzle_pool_service import PuzzlePoolEmpty

DOMAIN_ERROR_CODES: dict[type[DomainError], str] = {
    ConflictError: "conflict",
    ElapsedExceedsGameAge: "elapsed_exceeds_game_age",
    ForbiddenError: "forbidden",
    GameNotComplete: "game_not_complete",
    GameNotFound: "game_not_found",
    GameLogFull: "game_log_full",
    GameNotInProgress: "game_not_in_progress",
    GameReviewUnavailable: "game_review_unavailable",
    InvalidHint: "invalid_hint",
    InvalidInputError: "invalid_input",
    InvalidMove: "invalid_move",
    InvalidNotes: "invalid_notes",
    LessonPracticeUnavailable: "lesson_practice_unavailable",
    LessonTechniqueUnknown: "lesson_technique_unknown",
    NotFoundError: "not_found",
    PartyForbidden: "party_forbidden",
    PartyFull: "party_full",
    PartyNotFound: "party_not_found",
    PartyNotWaiting: "party_not_waiting",
    PlayLockedError: "play_locked",
    PoolTakeRateLimited: "pool_take_rate_limited",
    PuzzleExportInvalid: "puzzle_export_invalid",
    PuzzleExportUnavailable: "puzzle_export_unavailable",
    PuzzlePoolEmpty: "puzzle_pool_empty",
    TooManyRequestsError: "too_many_requests",
    UnavailableError: "unavailable",
    UndoUnavailable: "undo_unavailable",
}


def _domain_error_types(error_type: type[DomainError]) -> list[type[DomainError]]:
    found: list[type[DomainError]] = []
    for subclass in error_type.__subclasses__():
        found.append(subclass)
        found.extend(_domain_error_types(subclass))
    return found


def test_every_domain_error_belongs_to_one_category() -> None:
    categories = set(HTTP_STATUS_BY_ERROR_CATEGORY)
    for error_type in _domain_error_types(DomainError):
        if error_type is DomainError or error_type in categories:
            continue
        matching = [category for category in categories if issubclass(error_type, category)]
        assert len(matching) == 1, error_type


def test_every_domain_error_code_comes_from_its_class_name() -> None:
    found = set(_domain_error_types(DomainError))
    assert found == set(DOMAIN_ERROR_CODES)
    for error_type, code in DOMAIN_ERROR_CODES.items():
        assert error_type.code == code
