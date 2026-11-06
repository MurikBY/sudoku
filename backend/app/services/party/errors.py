from app.services.errors import ConflictError, ForbiddenError, NotFoundError


class PartyNotFound(NotFoundError):
    pass


class PartyNotWaiting(ConflictError):
    pass


class PartyFull(ConflictError):
    pass


class PartyForbidden(ForbiddenError):
    pass
