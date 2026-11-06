import re
from typing import ClassVar

_SNAKE_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def _code_from_class_name(class_name: str) -> str:
    stem = class_name.removesuffix("Error")
    if stem == "":
        raise ValueError(f"cannot derive an error code from class name {class_name}")
    return _SNAKE_BOUNDARY.sub("_", stem).lower()


# Categories of expected failures; the API layer maps each category to one HTTP status.
class DomainError(Exception):
    code: ClassVar[str]

    def __init_subclass__(cls, **kwargs: object) -> None:
        super().__init_subclass__(**kwargs)
        if "code" not in cls.__dict__:
            cls.code = _code_from_class_name(cls.__name__)


class NotFoundError(DomainError):
    pass


class ForbiddenError(DomainError):
    pass


class ConflictError(DomainError):
    pass


class TooManyRequestsError(DomainError):
    pass


class InvalidInputError(DomainError):
    pass


class UnavailableError(DomainError):
    pass
