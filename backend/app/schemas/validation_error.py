from typing import Literal

from pydantic import BaseModel


class ValidationField(BaseModel):
    loc: list[str | int]
    msg: str


class ValidationErrorResponse(BaseModel):
    code: Literal["validation_error"]
    message: Literal["Request validation failed"]
    fields: list[ValidationField]
