import json
import urllib.request
import uuid
from pathlib import Path

TELEGRAM_TIMEOUT_SECONDS = 120


def multipart_body(fields: dict[str, str], file_field: str, file_path: Path) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for name, value in fields.items():
        disposition = f'Content-Disposition: form-data; name="{name}"'
        parts.append(f"--{boundary}\r\n{disposition}\r\n\r\n{value}\r\n".encode())
    parts.append(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n"
        ).encode()
        + file_path.read_bytes()
        + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _post(bot_token: str, method: str, body: bytes, content_type: str) -> None:
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{bot_token}/{method}",
        data=body,
        headers={"Content-Type": content_type},
    )
    with urllib.request.urlopen(request, timeout=TELEGRAM_TIMEOUT_SECONDS) as response:
        answer = json.loads(response.read())
    if answer.get("ok") is not True:
        raise RuntimeError(f"Telegram {method} failed: {answer.get('description')}")


def send_message(bot_token: str, chat_id: int, text: str) -> None:
    body = json.dumps({"chat_id": chat_id, "text": text}).encode()
    _post(bot_token, "sendMessage", body, "application/json")


def send_document(bot_token: str, chat_id: int, file_path: Path, caption: str) -> None:
    body, content_type = multipart_body(
        {"chat_id": str(chat_id), "caption": caption},
        "document",
        file_path,
    )
    _post(bot_token, "sendDocument", body, content_type)
