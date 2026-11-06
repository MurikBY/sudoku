from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.schemas.validation_error import ValidationErrorResponse
from app.services.errors import (
    ConflictError,
    DomainError,
    ForbiddenError,
    InvalidInputError,
    NotFoundError,
    TooManyRequestsError,
    UnavailableError,
)

HTTP_STATUS_BY_ERROR_CATEGORY: dict[type[DomainError], int] = {
    InvalidInputError: 400,
    ForbiddenError: 403,
    NotFoundError: 404,
    ConflictError: 409,
    TooManyRequestsError: 429,
    UnavailableError: 503,
}

# Starlette raises this base for unknown routes and methods.
# FastAPI's HTTPException subclasses it, so one handler covers both.
_HTTP_CODE_BY_STATUS: dict[int, str] = {
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    503: "unavailable",
}


def _domain_error_handler(
    status_code: int,
) -> Callable[[Request, Exception], Awaitable[JSONResponse]]:
    async def respond(_request: Request, error: Exception) -> JSONResponse:
        if not isinstance(error, DomainError):
            raise TypeError("expected DomainError")
        return JSONResponse(
            status_code=status_code,
            content={"code": error.code, "message": str(error)},
        )

    return respond


def _http_error_body(error: HTTPException) -> dict[str, str]:
    try:
        code = _HTTP_CODE_BY_STATUS[error.status_code]
    except KeyError as missing:
        raise ValueError(f"no error code for HTTP status {error.status_code}") from missing
    if not isinstance(error.detail, str):
        raise ValueError("HTTPException detail must be a string")
    return {"code": code, "message": error.detail}


async def _respond_http_exception(_request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, HTTPException):
        raise TypeError("expected HTTPException")
    return JSONResponse(
        status_code=error.status_code,
        content=_http_error_body(error),
        headers=error.headers,
    )


def _loc_part(part: object) -> str | int:
    if isinstance(part, bool) or not isinstance(part, str | int):
        raise ValueError("validation error loc must be strings and integers")
    return part


def _loc_parts(loc: object) -> list[str | int]:
    if not isinstance(loc, tuple):
        raise ValueError("validation error loc must be a tuple")
    return [_loc_part(part) for part in loc]


def _validation_field(item: object) -> dict[str, object]:
    if not isinstance(item, dict):
        raise ValueError("validation error must be a dict")
    try:
        loc = item["loc"]
        msg = item["msg"]
    except KeyError as missing:
        raise ValueError("validation error must include loc and msg") from missing
    if not isinstance(msg, str):
        raise ValueError("validation error msg must be a string")
    return {"loc": _loc_parts(loc), "msg": msg}


def _validation_fields(error: RequestValidationError) -> list[dict[str, object]]:
    return [_validation_field(item) for item in error.errors()]


async def _respond_validation(_request: Request, error: Exception) -> JSONResponse:
    if not isinstance(error, RequestValidationError):
        raise TypeError("expected RequestValidationError")
    body = ValidationErrorResponse.model_validate(
        {
            "code": "validation_error",
            "message": "Request validation failed",
            "fields": _validation_fields(error),
        },
    )
    return JSONResponse(status_code=422, content=body.model_dump(mode="json"))


def register_domain_error_handlers(app: FastAPI) -> None:
    for category, status_code in HTTP_STATUS_BY_ERROR_CATEGORY.items():
        app.add_exception_handler(category, _domain_error_handler(status_code))
    app.add_exception_handler(HTTPException, _respond_http_exception)
    app.add_exception_handler(RequestValidationError, _respond_validation)


# FastAPI documents 422 as HTTPValidationError. The handler returns ValidationErrorResponse.
_VALIDATION_ERROR_REF = "#/components/schemas/ValidationErrorResponse"
_FASTAPI_VALIDATION_REF = "#/components/schemas/HTTPValidationError"
_HTTP_METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}


def install_validation_error_schema(app: FastAPI) -> None:
    original_openapi = app.openapi

    def openapi() -> dict[str, Any]:
        schema = original_openapi()
        _replace_validation_error_schema(schema)
        return schema

    app.openapi = openapi  # type: ignore[method-assign]  # FastAPI replaces this method


def _replace_validation_error_schema(schema: dict[str, Any]) -> None:
    components = _schema_components(schema)
    components.update(_validation_error_components())
    _replace_validation_responses(_paths(schema))
    if "webhooks" in schema:
        _replace_validation_responses(_webhooks(schema))
    components.pop("HTTPValidationError", None)
    components.pop("ValidationError", None)
    _require_no_fastapi_validation_refs(schema)


def _schema_components(schema: dict[str, Any]) -> dict[str, Any]:
    try:
        components = schema["components"]["schemas"]
    except KeyError as missing:
        raise ValueError("OpenAPI document is missing components.schemas") from missing
    if not isinstance(components, dict):
        raise ValueError("OpenAPI components.schemas must be an object")
    return components


def _paths(schema: dict[str, Any]) -> dict[str, Any]:
    paths = schema.get("paths")
    if not isinstance(paths, dict):
        raise ValueError("OpenAPI document is missing paths")
    return paths


def _webhooks(schema: dict[str, Any]) -> dict[str, Any]:
    webhooks = schema["webhooks"]
    if not isinstance(webhooks, dict):
        raise ValueError("OpenAPI webhooks must be an object")
    return webhooks


def _validation_error_components() -> dict[str, Any]:
    response_schema = ValidationErrorResponse.model_json_schema(
        ref_template="#/components/schemas/{model}",
    )
    definitions = response_schema.pop("$defs", None)
    if not isinstance(definitions, dict) or "ValidationField" not in definitions:
        raise ValueError("validation error schema is missing ValidationField")
    components = dict(definitions)
    components["ValidationErrorResponse"] = response_schema
    return components


def _replace_validation_responses(paths: dict[str, Any]) -> None:
    for path_item in paths.values():
        if not isinstance(path_item, dict):
            raise ValueError("OpenAPI path item must be an object")
        for method, operation in path_item.items():
            if method not in _HTTP_METHODS:
                continue
            if not isinstance(operation, dict):
                raise ValueError(f"OpenAPI operation {method} must be an object")
            responses = operation.get("responses")
            if not isinstance(responses, dict):
                raise ValueError(f"OpenAPI operation {method} responses must be an object")
            if "422" not in responses:
                continue
            _replace_validation_response(responses["422"])


def _replace_validation_response(response: dict[str, Any]) -> None:
    try:
        json_schema = response["content"]["application/json"]["schema"]
    except (KeyError, TypeError) as error:
        raise ValueError("422 response is missing an application/json schema") from error
    ref = json_schema.get("$ref") if isinstance(json_schema, dict) else None
    if ref == _VALIDATION_ERROR_REF:
        return
    if ref != _FASTAPI_VALIDATION_REF:
        raise ValueError(f"unexpected 422 schema: {ref}")
    response["content"]["application/json"]["schema"] = {"$ref": _VALIDATION_ERROR_REF}


def _require_no_fastapi_validation_refs(value: object) -> None:
    if isinstance(value, dict):
        for item in value.values():
            _require_no_fastapi_validation_refs(item)
        return
    if isinstance(value, list):
        for item in value:
            _require_no_fastapi_validation_refs(item)
        return
    if value == _FASTAPI_VALIDATION_REF:
        raise ValueError("OpenAPI still references HTTPValidationError")
