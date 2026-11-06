from app.services.errors import ConflictError, InvalidInputError, NotFoundError


class GameNotFound(NotFoundError):
    pass


class GameNotInProgress(ConflictError):
    pass


class InvalidMove(InvalidInputError):
    pass


class InvalidHint(InvalidInputError):
    pass


class InvalidNotes(InvalidInputError):
    pass


class GameNotComplete(InvalidInputError):
    pass


class ElapsedExceedsGameAge(InvalidInputError):
    pass


class GameReviewUnavailable(InvalidInputError):
    pass


class UndoUnavailable(ConflictError):
    pass


class LessonTechniqueUnknown(InvalidInputError):
    pass


class LessonPracticeUnavailable(NotFoundError):
    pass
