from __future__ import annotations

import json

from aiogram import Bot
from aiogram.types import BufferedInputFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.game import PuzzleExportRequest
from app.services.errors import InvalidInputError, UnavailableError
from app.services.games.review import get_game_review_by_code
from app.services.sudoku.grid import CELL_COUNT

PUZZLE_EXPORT_FORMAT = "sudoku-export-v1"


class PuzzleExportInvalid(InvalidInputError):
    pass


class PuzzleExportUnavailable(UnavailableError):
    pass


def _require_grid(grid: str, field: str) -> str:
    if len(grid) != CELL_COUNT:
        raise PuzzleExportInvalid(f"{field} must be {CELL_COUNT} characters")
    if any(char < "0" or char > "9" for char in grid):
        raise PuzzleExportInvalid(f"{field} has invalid character")
    return grid


def _require_notes(notes: dict[str, list[int]]) -> dict[str, list[int]]:
    cleaned: dict[str, list[int]] = {}
    for raw_key, raw_digits in notes.items():
        if not raw_key.isdigit():
            raise PuzzleExportInvalid(f"invalid note cell: {raw_key}")
        cell = int(raw_key)
        if cell < 0 or cell >= CELL_COUNT:
            raise PuzzleExportInvalid(f"invalid note cell: {raw_key}")
        digits: list[int] = []
        seen: set[int] = set()
        for digit in raw_digits:
            if digit < 1 or digit > 9:
                raise PuzzleExportInvalid(f"note digit out of range at cell {cell}: {digit}")
            if digit in seen:
                raise PuzzleExportInvalid(f"duplicate note digit at cell {cell}: {digit}")
            seen.add(digit)
            digits.append(digit)
        if digits:
            cleaned[str(cell)] = digits
    return cleaned


def puzzle_export_filename(share_code: str) -> str:
    trimmed = share_code.strip().upper()
    if trimmed == "":
        raise PuzzleExportInvalid("share_code required")
    return f"sudoku-{trimmed}.json"


def puzzle_export_json(payload: PuzzleExportRequest) -> str:
    data = payload.model_dump()
    return (
        "{\n"
        f'  "format": {json.dumps(data["format"])},\n'
        f'  "share_code": {json.dumps(data["share_code"])},\n'
        f'  "difficulty": {json.dumps(data["difficulty"])},\n'
        f'  "puzzle": {json.dumps(data["puzzle"])},\n'
        f'  "grid": {json.dumps(data["grid"])},\n'
        f'  "notes": {json.dumps(data["notes"], separators=(", ", ": "))},\n'
        f'  "board": {json.dumps(data["board"])}\n'
        "}\n"
    )


async def send_puzzle_export_to_chat(
    bot: Bot | None,
    session: AsyncSession,
    user_id: int,
    payload: PuzzleExportRequest,
) -> None:
    if bot is None:
        raise PuzzleExportUnavailable("telegram bot is not configured")
    if payload.format != PUZZLE_EXPORT_FORMAT:
        raise PuzzleExportInvalid("unsupported export format")

    share_code = payload.share_code.strip().upper()
    puzzle = _require_grid(payload.puzzle, "puzzle")
    grid = _require_grid(payload.grid, "grid")
    notes = _require_notes(payload.notes)
    if payload.board.strip() == "":
        raise PuzzleExportInvalid("board required")

    review = await get_game_review_by_code(session, share_code)
    game = review.game
    if game.puzzle != puzzle:
        raise PuzzleExportInvalid("puzzle does not match share_code")
    if game.difficulty != payload.difficulty:
        raise PuzzleExportInvalid("difficulty does not match share_code")

    normalized = PuzzleExportRequest(
        format=PUZZLE_EXPORT_FORMAT,
        share_code=share_code,
        difficulty=payload.difficulty,
        puzzle=puzzle,
        grid=grid,
        notes=notes,
        board=payload.board,
    )
    document = BufferedInputFile(
        puzzle_export_json(normalized).encode("utf-8"),
        filename=puzzle_export_filename(share_code),
    )
    try:
        await bot.send_document(
            chat_id=user_id,
            document=document,
            caption=f"Board export {share_code}",
        )
    except Exception as error:
        raise PuzzleExportUnavailable("could not send file to Telegram") from error
