from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient

from app.api.request_body_limit import MAX_REQUEST_BODY_BYTES

TOO_LARGE = {
    "code": "payload_too_large",
    "message": f"Request body is larger than {MAX_REQUEST_BODY_BYTES} bytes",
}


@pytest.mark.asyncio
async def test_declared_oversized_body_is_rejected_before_auth(async_client: AsyncClient) -> None:
    response = await async_client.post(
        "/api/parties/join",
        content=b" " * (MAX_REQUEST_BODY_BYTES + 1),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json() == TOO_LARGE


@pytest.mark.asyncio
async def test_chunked_body_is_cut_off_once_it_passes_the_limit(async_client: AsyncClient) -> None:
    chunk = b" " * (64 * 1024)

    async def chunks() -> AsyncIterator[bytes]:
        for _ in range(MAX_REQUEST_BODY_BYTES // len(chunk) + 1):
            yield chunk

    response = await async_client.post(
        "/api/parties/join",
        content=chunks(),
        headers={"Content-Type": "application/json"},
    )
    assert "content-length" not in {name.lower() for name in response.request.headers}
    assert response.status_code == 413
    assert response.json() == TOO_LARGE


@pytest.mark.asyncio
async def test_body_at_the_limit_reaches_the_route(async_client: AsyncClient) -> None:
    response = await async_client.post(
        "/api/parties/join",
        content=b" " * MAX_REQUEST_BODY_BYTES,
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
