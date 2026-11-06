from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, TypeAdapter, ValidationError

CellIndex = Annotated[StrictInt, Field(ge=0, le=80)]
Digit = Annotated[StrictInt, Field(ge=1, le=9)]
_CellValue = Annotated[StrictInt, Field(ge=0, le=9)]
_CellKey = Annotated[str, Field(pattern=r"^(?:0|[1-9]|[1-7][0-9]|80)$")]

# An empty digit list stays in an event. It records a peer cell whose notes were cleared.
NotesMap = dict[_CellKey, list[Digit]]


class _StoredModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class SetEvent(_StoredModel):
    kind: Literal["set"]
    cell: CellIndex
    value: Digit
    peer_notes: NotesMap | None = None


class HintEvent(_StoredModel):
    kind: Literal["hint"]
    cell: CellIndex
    value: Digit
    peer_notes: NotesMap | None = None


class ClearEvent(_StoredModel):
    kind: Literal["clear"]
    cell: CellIndex


class NotesEvent(_StoredModel):
    kind: Literal["notes"]
    cell: CellIndex
    notes: list[Digit]


StoredEvent = Annotated[
    SetEvent | HintEvent | ClearEvent | NotesEvent,
    Field(discriminator="kind"),
]


class UndoEntry(_StoredModel):
    index: CellIndex
    previous_value: _CellValue | None
    previous_notes: NotesMap


events_adapter: TypeAdapter[list[StoredEvent]] = TypeAdapter(list[StoredEvent])
undo_stack_adapter: TypeAdapter[list[UndoEntry]] = TypeAdapter(list[UndoEntry])
notes_adapter: TypeAdapter[NotesMap] = TypeAdapter(NotesMap)


def read_events(raw: object) -> list[StoredEvent]:
    return events_adapter.validate_python(raw)


def dump_stored_event(event: StoredEvent) -> dict[str, Any]:
    return event.model_dump(exclude_none=True)


def dump_game_event(
    kind: Literal["set", "clear", "notes", "hint"],
    *,
    cell: int | None = None,
    value: int | None = None,
    notes: list[int] | None = None,
    peer_notes: dict[str, list[int]] | None = None,
) -> dict[str, Any]:
    raw: dict[str, Any] = {"kind": kind}
    if cell is not None:
        raw["cell"] = cell
    if kind in {"set", "hint"}:
        if value is not None:
            raw["value"] = value
        if peer_notes:
            raw["peer_notes"] = peer_notes
    elif kind == "notes" and notes is not None:
        raw["notes"] = notes
    return dump_stored_event(read_events([raw])[0])


def _normalize_notes_map(notes: dict[str, list[int]]) -> dict[str, list[int]]:
    normalized: dict[str, list[int]] = {}
    for cell_key, digits in notes.items():
        unique_digits = sorted(set(digits))
        if unique_digits:
            normalized[cell_key] = unique_digits
    return normalized


def read_notes(raw: object) -> dict[str, list[int]]:
    return _normalize_notes_map(notes_adapter.validate_python(raw))


def dump_notes(notes: dict[str, list[int]]) -> dict[str, list[int]]:
    validated = notes_adapter.validate_python(notes)
    return {cell_key: list(digits) for cell_key, digits in validated.items()}


def dump_undo_entry(
    *,
    index: int,
    previous_value: int | None,
    previous_notes: dict[str, list[int]],
) -> dict[str, Any]:
    entry = UndoEntry(
        index=index,
        previous_value=previous_value,
        previous_notes=previous_notes,
    )
    return entry.model_dump()


def read_undo_entry(raw: object) -> tuple[int, int | None, dict[str, list[int]]]:
    try:
        entry = UndoEntry.model_validate(raw)
    except ValidationError as error:
        raise RuntimeError("invalid undo entry") from error
    return entry.index, entry.previous_value, _normalize_notes_map(entry.previous_notes)
