from sqlalchemy.orm.attributes import flag_modified

from app.models.game import Game
from app.services.game_events import append_game_event
from app.services.games.stored_state import dump_notes
from app.services.sudoku.grid import EMPTY_CELL, parse_grid, peer_indices


def copy_notes_map(notes: dict[str, list[int]]) -> dict[str, list[int]]:
    return {cell_key: list(digits) for cell_key, digits in notes.items()}


def validate_notes_target(puzzle: str, current_grid: str, cell_index: int) -> None:
    if cell_index < 0 or cell_index >= len(current_grid):
        raise ValueError(f"cell index out of bounds: {cell_index}")

    puzzle_values = parse_grid(puzzle)
    if puzzle_values[cell_index] != EMPTY_CELL:
        raise ValueError("cannot note given cell")

    current_values = parse_grid(current_grid)
    if current_values[cell_index] != EMPTY_CELL:
        raise ValueError("notes require empty cell")


def normalize_note_digits(digits: list[int]) -> list[int]:
    normalized: list[int] = []
    seen: set[int] = set()
    for digit in digits:
        if digit < 1 or digit > 9:
            raise ValueError(f"note digit out of range: {digit}")
        if digit in seen:
            continue
        seen.add(digit)
        normalized.append(digit)
    return sorted(normalized)


def notes_changed_cell_indices(
    current_notes: dict[str, list[int]],
    target_notes: dict[str, list[int]],
) -> list[int]:
    changed: list[int] = []
    for cell_key in sorted(set(current_notes) | set(target_notes), key=int):
        if current_notes.get(cell_key, []) != target_notes.get(cell_key, []):
            changed.append(int(cell_key))
    return changed


def replace_notes_map(game: Game, target_notes: dict[str, list[int]]) -> None:
    current_notes = dict(game.notes)
    changed_cell_indices = notes_changed_cell_indices(current_notes, target_notes)
    game.notes = dump_notes(target_notes)
    flag_modified(game, "notes")
    for changed_index in changed_cell_indices:
        append_game_event(
            game,
            "notes",
            cell=changed_index,
            notes=target_notes.get(str(changed_index), []),
        )


def clear_cell_notes(game: Game, cell_index: int) -> None:
    cell_key = str(cell_index)
    if cell_key not in game.notes:
        return
    notes = dict(game.notes)
    notes.pop(cell_key, None)
    game.notes = dump_notes(notes)
    flag_modified(game, "notes")


def remove_digit_from_peer_notes(
    game: Game,
    cell_index: int,
    digit: int,
) -> dict[str, list[int]]:
    notes = dict(game.notes)
    peer_notes: dict[str, list[int]] = {}
    for peer_index in peer_indices(cell_index):
        cell_key = str(peer_index)
        peer_digits = notes.get(cell_key)
        if peer_digits is None or digit not in peer_digits:
            continue
        remaining = [value for value in peer_digits if value != digit]
        if remaining:
            notes[cell_key] = remaining
        else:
            notes.pop(cell_key, None)
        peer_notes[cell_key] = remaining
    if not peer_notes:
        return {}
    game.notes = dump_notes(notes)
    flag_modified(game, "notes")
    return peer_notes
