from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from app.models.enums import LessonRole
from app.services.sudoku.coach_step import NotesIssue, NotesIssueKind
from app.services.sudoku.grid import HouseKind, parse_grid
from app.services.sudoku.technique import TECHNIQUE_ORDER, Technique
from app.services.sudoku.technique_steps import TechniqueStep

PENCIL_LESSON = "pencil"
LESSON_POOL_SIZE = 9
LESSON_TECHNIQUES: tuple[str, ...] = (
    *(technique.value for technique in TECHNIQUE_ORDER),
    PENCIL_LESSON,
)

CellIndex = Annotated[StrictInt, Field(ge=0, le=80)]
Digit = Annotated[StrictInt, Field(ge=1, le=9)]
# Canonical decimal cell indexes: "0".."80", no leading zero.
_CellKey = Annotated[str, Field(pattern=r"^(?:0|[1-9]|[1-7][0-9]|80)$")]
_NoteDigits = Annotated[list[Digit], Field(min_length=1)]
_Cells = list[CellIndex]
_NonEmptyCells = Annotated[list[CellIndex], Field(min_length=1)]


class TechniqueStepPayload(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    technique: Technique
    outline_cells: _NonEmptyCells
    focus_cells: _NonEmptyCells
    elim_cells: _Cells
    digit: Digit | None = None
    digits: list[Digit]
    house: HouseKind | None = None
    house_index: int | None = None

    @classmethod
    def from_step(cls, step: TechniqueStep) -> Self:
        return cls(
            technique=step.technique,
            outline_cells=list(step.outline_cells),
            focus_cells=list(step.focus_cells),
            elim_cells=list(step.elim_cells),
            digit=step.digit,
            digits=list(step.digits),
            house=step.house,
            house_index=step.house_index,
        )

    def to_step(self) -> TechniqueStep:
        return TechniqueStep(
            technique=self.technique,
            outline_cells=tuple(self.outline_cells),
            focus_cells=tuple(self.focus_cells),
            elim_cells=tuple(self.elim_cells),
            digit=self.digit,
            digits=tuple(self.digits),
            house=self.house,
            house_index=self.house_index,
        )


class NotesIssuePayload(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    kind: Literal["empty", "incomplete"]
    cell_index: CellIndex
    digit: Digit | None = None
    digits: list[Digit]
    house: HouseKind | None = None
    outline_cells: _Cells
    house_index: int | None = None

    @classmethod
    def from_issue(cls, issue: NotesIssue) -> Self:
        return cls(
            kind=_accepted_issue_kind(issue.kind),
            cell_index=issue.cell_index,
            digit=issue.digit,
            digits=list(issue.digits),
            house=issue.house,
            outline_cells=list(issue.outline_cells),
            house_index=issue.house_index,
        )


class LessonPosition(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)

    id: str
    technique: str
    role: LessonRole
    puzzle: str
    solution: str
    grid: str
    notes: dict[_CellKey, _NoteDigits]
    step: TechniqueStepPayload | None = None
    notes_issue: NotesIssuePayload | None = None

    @field_validator("puzzle", "solution", "grid")
    @classmethod
    def _grids(cls, value: str) -> str:
        parse_grid(value)
        return value

    @field_validator("notes")
    @classmethod
    def _sorted_unique_notes(cls, notes: dict[str, list[int]]) -> dict[str, list[int]]:
        for key, digits in notes.items():
            if digits != sorted(set(digits)):
                raise ValueError(f"lesson notes at {key} must be sorted unique digits")
        return notes

    @model_validator(mode="after")
    def _step_or_notes_issue(self) -> Self:
        if self.technique == PENCIL_LESSON:
            if self.step is not None:
                raise ValueError("pencil lesson must not include a technique step")
            if self.notes_issue is None:
                raise ValueError("pencil notes_issue must be an object")
            return self
        if self.notes_issue is not None:
            raise ValueError(f"{self.technique} lesson must not include notes_issue")
        if self.step is None:
            raise ValueError("lesson step must be an object")
        return self


def _accepted_issue_kind(kind: NotesIssueKind) -> Literal["empty", "incomplete"]:
    if kind is NotesIssueKind.empty:
        return "empty"
    if kind is NotesIssueKind.incomplete:
        return "incomplete"
    raise ValueError(f"pencil notes_issue kind must be empty or incomplete, got {kind.value}")
