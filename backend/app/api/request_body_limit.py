from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# nginx's default client_max_body_size. The largest real request is a few kilobytes.
MAX_REQUEST_BODY_BYTES = 1024 * 1024


# Checks the body while it is read, and FastAPI reads it before auth runs.
class RequestBodyLimit:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        await self.app(scope, _receive_within_limit(scope, receive), send)


def _receive_within_limit(scope: Scope, receive: Receive) -> Receive:
    declared_bytes = _declared_body_bytes(scope)
    received_bytes = 0

    async def receive_checked() -> Message:
        nonlocal received_bytes
        if declared_bytes is not None and declared_bytes > MAX_REQUEST_BODY_BYTES:
            raise _body_too_large()
        message = await receive()
        if message["type"] == "http.request":
            received_bytes += len(message.get("body", b""))
            if received_bytes > MAX_REQUEST_BODY_BYTES:
                raise _body_too_large()
        return message

    return receive_checked


def _declared_body_bytes(scope: Scope) -> int | None:
    for name, value in scope["headers"]:
        if name == b"content-length":
            return int(value)
    return None


def _body_too_large() -> HTTPException:
    # FastAPI re-raises an HTTPException from body reading, so api/errors.py builds the 413.
    return HTTPException(
        status_code=413,
        detail=f"Request body is larger than {MAX_REQUEST_BODY_BYTES} bytes",
    )
