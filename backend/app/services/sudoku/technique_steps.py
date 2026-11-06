from collections.abc import Iterator
from dataclasses import dataclass
from enum import StrEnum
from itertools import combinations

from app.services.sudoku.grid import (
    EMPTY_CELL,
    GRID_SIDE,
    HOUSES,
    HouseKind,
    box_cell_indices,
    box_index,
    cell_index,
    col_cell_indices,
    peer_indices,
    row_cell_indices,
    row_col,
)
from app.services.sudoku.technique import DIGIT_TECHNIQUES, Technique


class LineAxis(StrEnum):
    row = "row"
    col = "col"


@dataclass(frozen=True)
class TechniqueStep:
    technique: Technique
    outline_cells: tuple[int, ...]
    focus_cells: tuple[int, ...]
    digit: int | None = None
    digits: tuple[int, ...] = ()
    house: HouseKind | None = None
    house_index: int | None = None
    elim_cells: tuple[int, ...] = ()

    def __post_init__(self) -> None:
        if self.technique in DIGIT_TECHNIQUES and self.digit is None:
            raise ValueError(f"{self.technique.value} step missing digit")

    @property
    def digit_value(self) -> int:
        digit = self.digit
        if digit is None:
            raise ValueError(f"{self.technique.value} step missing digit")
        return digit


@dataclass(frozen=True)
class _FishRule:
    technique: Technique
    choose: int
    cover_min: int
    cover_max: int
    matching_covers: bool
    union_size: int | None


_X_WING = _FishRule(
    technique=Technique.X_WING,
    choose=2,
    cover_min=2,
    cover_max=2,
    matching_covers=True,
    union_size=None,
)
_SWORDFISH = _FishRule(
    technique=Technique.SWORDFISH,
    choose=3,
    cover_min=2,
    cover_max=3,
    matching_covers=False,
    union_size=3,
)


def outside_digit_cells(
    values: list[int],
    candidates: list[set[int]],
    scope: list[int] | set[int],
    excluded: set[int],
    digit: int,
) -> tuple[int, ...]:
    return tuple(
        sorted(
            index
            for index in scope
            if index not in excluded and values[index] == EMPTY_CELL and digit in candidates[index]
        )
    )


def _fish_cover_elim_cells(
    values: list[int],
    candidates: list[set[int]],
    pattern: tuple[int, ...],
    cover_indices: set[int],
    *,
    cover_is_column: bool,
    digit: int,
) -> tuple[int, ...]:
    scope: list[int] = []
    if cover_is_column:
        for col in cover_indices:
            scope.extend(col_cell_indices(col))
    else:
        for row in cover_indices:
            scope.extend(row_cell_indices(row))
    return outside_digit_cells(values, candidates, scope, set(pattern), digit)


def iter_x_wings(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for digit in range(1, GRID_SIDE + 1):
        yield from _iter_fish_axis(values, candidates, digit, LineAxis.row, _X_WING)
        yield from _iter_fish_axis(values, candidates, digit, LineAxis.col, _X_WING)


def iter_swordfishes(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for digit in range(1, GRID_SIDE + 1):
        yield from _iter_fish_axis(values, candidates, digit, LineAxis.row, _SWORDFISH)
        yield from _iter_fish_axis(values, candidates, digit, LineAxis.col, _SWORDFISH)


def _fish_covers(
    values: list[int],
    candidates: list[set[int]],
    digit: int,
    axis: LineAxis,
    cover_min: int,
    cover_max: int,
) -> dict[int, set[int]]:
    covers: dict[int, set[int]] = {}
    for line in range(GRID_SIDE):
        crosses: set[int] = set()
        for cross in range(GRID_SIDE):
            index = cell_index(line, cross) if axis == LineAxis.row else cell_index(cross, line)
            if values[index] == EMPTY_CELL and digit in candidates[index]:
                crosses.add(cross)
        if cover_min <= len(crosses) <= cover_max:
            covers[line] = crosses
    return covers


def _fish_pattern_cells(
    axis: LineAxis,
    lines: tuple[int, ...],
    covers: dict[int, set[int]],
) -> tuple[int, ...]:
    cells: list[int] = []
    for line in lines:
        for cross in covers[line]:
            cell = cell_index(line, cross) if axis == LineAxis.row else cell_index(cross, line)
            cells.append(cell)
    return tuple(sorted(cells))


def _iter_fish_axis(
    values: list[int],
    candidates: list[set[int]],
    digit: int,
    axis: LineAxis,
    rule: _FishRule,
) -> Iterator[TechniqueStep]:
    covers = _fish_covers(values, candidates, digit, axis, rule.cover_min, rule.cover_max)
    for lines in combinations(covers, rule.choose):
        if rule.matching_covers:
            shared = covers[lines[0]]
            if any(covers[line] != shared for line in lines[1:]):
                continue
            cover_union = shared
        else:
            cover_union = set()
            for line in lines:
                cover_union |= covers[line]
            if rule.union_size is None:
                raise RuntimeError(f"{rule.technique.value} fish missing union size")
            if len(cover_union) != rule.union_size:
                continue
        pattern = _fish_pattern_cells(axis, lines, covers)
        elim_cells = _fish_cover_elim_cells(
            values,
            candidates,
            pattern,
            cover_union,
            cover_is_column=axis == LineAxis.row,
            digit=digit,
        )
        if not elim_cells:
            continue
        house = HouseKind.row if axis == LineAxis.row else HouseKind.col
        yield TechniqueStep(
            technique=rule.technique,
            outline_cells=pattern,
            focus_cells=pattern,
            digit=digit,
            digits=(digit,),
            house=house,
            elim_cells=elim_cells,
        )


def eliminate_locked_digit(
    step: TechniqueStep,
    values: list[int],
    candidates: list[set[int]],
) -> None:
    digit = step.digit_value
    for index in step.elim_cells:
        if values[index] != EMPTY_CELL:
            continue
        candidates[index].discard(digit)


def eliminate_box_line(
    step: TechniqueStep,
    values: list[int],
    candidates: list[set[int]],
) -> None:
    if step.house is None or step.house_index is None:
        raise RuntimeError("box/line step missing house")
    digit = step.digit_value
    if step.house == HouseKind.row:
        line = set(row_cell_indices(step.house_index))
    else:
        line = set(col_cell_indices(step.house_index))
    for index in step.outline_cells:
        if index in line or values[index] != EMPTY_CELL:
            continue
        candidates[index].discard(digit)


def iter_pointing_pairs(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for box in range(GRID_SIDE):
        box_indices = set(box_cell_indices(box))
        for digit in range(1, GRID_SIDE + 1):
            matching_indices = [
                index
                for index in box_indices
                if values[index] == EMPTY_CELL and digit in candidates[index]
            ]
            if len(matching_indices) < 2:
                continue
            rows = {row_col(index)[0] for index in matching_indices}
            if len(rows) == 1:
                row = next(iter(rows))
                elims = outside_digit_cells(
                    values,
                    candidates,
                    row_cell_indices(row),
                    box_indices,
                    digit,
                )
                if elims:
                    yield _pointing_pair_step(box, digit, matching_indices, elims)
            cols = {row_col(index)[1] for index in matching_indices}
            if len(cols) == 1:
                col = next(iter(cols))
                elims = outside_digit_cells(
                    values,
                    candidates,
                    col_cell_indices(col),
                    box_indices,
                    digit,
                )
                if elims:
                    yield _pointing_pair_step(box, digit, matching_indices, elims)


def _pointing_pair_step(
    box: int,
    digit: int,
    matching_indices: list[int],
    elims: tuple[int, ...],
) -> TechniqueStep:
    return TechniqueStep(
        technique=Technique.POINTING_PAIR,
        outline_cells=tuple(box_cell_indices(box)),
        focus_cells=tuple(sorted(matching_indices)),
        digit=digit,
        digits=(digit,),
        house=HouseKind.box,
        house_index=box,
        elim_cells=elims,
    )


def iter_box_line_reductions(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for row in range(GRID_SIDE):
        yield from _iter_box_line_on_line(
            values,
            candidates,
            row_cell_indices(row),
            HouseKind.row,
            row,
        )
    for col in range(GRID_SIDE):
        yield from _iter_box_line_on_line(
            values,
            candidates,
            col_cell_indices(col),
            HouseKind.col,
            col,
        )


def _iter_box_line_on_line(
    values: list[int],
    candidates: list[set[int]],
    line: list[int],
    house: HouseKind,
    house_index: int,
) -> Iterator[TechniqueStep]:
    for digit in range(1, GRID_SIDE + 1):
        matching_indices = [
            index for index in line if values[index] == EMPTY_CELL and digit in candidates[index]
        ]
        if len(matching_indices) < 2:
            continue
        boxes = {box_index(*row_col(index)) for index in matching_indices}
        if len(boxes) != 1:
            continue
        box = next(iter(boxes))
        box_cells = box_cell_indices(box)
        line_set = set(line)
        if not _digit_outside_set(values, candidates, box_cells, line_set, digit):
            continue
        yield TechniqueStep(
            technique=Technique.BOX_LINE_REDUCTION,
            outline_cells=_unique_cells(*line, *box_cells),
            focus_cells=tuple(sorted(matching_indices)),
            digit=digit,
            digits=(digit,),
            house=house,
            house_index=house_index,
            elim_cells=outside_digit_cells(
                values,
                candidates,
                box_cells,
                line_set,
                digit,
            ),
        )


def _digit_outside_set(
    values: list[int],
    candidates: list[set[int]],
    scope: list[int] | set[int],
    excluded: set[int],
    digit: int,
) -> bool:
    return bool(outside_digit_cells(values, candidates, scope, excluded, digit))


def _unique_cells(*indices: int) -> tuple[int, ...]:
    return tuple(sorted(set(indices)))


def eliminate_hidden_pair(step: TechniqueStep, candidates: list[set[int]]) -> None:
    pair = set(step.digits)
    for index in step.focus_cells:
        candidates[index] &= pair


def eliminate_naked_pair(
    step: TechniqueStep,
    values: list[int],
    candidates: list[set[int]],
) -> None:
    pair = set(step.digits)
    focus = set(step.focus_cells)
    for index in step.outline_cells:
        if index in focus or values[index] != EMPTY_CELL:
            continue
        candidates[index] -= pair


def _outside_pair_cells(
    values: list[int],
    candidates: list[set[int]],
    cells: tuple[int, ...],
    pair_cells: tuple[int, ...],
    pair_digits: frozenset[int],
) -> tuple[int, ...]:
    focus = set(pair_cells)
    digits = set(pair_digits)
    return tuple(
        sorted(
            index
            for index in cells
            if index not in focus
            and values[index] == EMPTY_CELL
            and bool(candidates[index] & digits)
        )
    )


def iter_naked_singles(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for index, value in enumerate(values):
        if value != EMPTY_CELL:
            continue
        if len(candidates[index]) != 1:
            continue
        digit = next(iter(candidates[index]))
        yield TechniqueStep(
            technique=Technique.NAKED_SINGLE,
            outline_cells=(index,),
            focus_cells=(index,),
            digit=digit,
            digits=(digit,),
        )


def iter_hidden_singles(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for house in HOUSES:
        for digit in range(1, GRID_SIDE + 1):
            matching_indices = [
                index
                for index in house.cells
                if values[index] == EMPTY_CELL and digit in candidates[index]
            ]
            if len(matching_indices) != 1:
                continue
            index = matching_indices[0]
            yield TechniqueStep(
                technique=Technique.HIDDEN_SINGLE,
                outline_cells=house.cells,
                focus_cells=(index,),
                digit=digit,
                digits=(digit,),
                house=house.kind,
                house_index=house.index,
            )


def _xy_wing_pincers(
    values: list[int],
    candidates: list[set[int]],
    pivot_peers: frozenset[int],
    first_digit: int,
    second_digit: int,
) -> list[int]:
    pincers: list[int] = []
    for index in pivot_peers:
        if values[index] != EMPTY_CELL:
            continue
        if candidates[index] == {first_digit, second_digit}:
            pincers.append(index)
    return pincers


def iter_xy_wings(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for pivot_index, pivot_value in enumerate(values):
        if pivot_value != EMPTY_CELL:
            continue
        if len(candidates[pivot_index]) != 2:
            continue
        first_digit, second_digit = tuple(sorted(candidates[pivot_index]))
        pivot_peers = peer_indices(pivot_index)
        for third_digit in range(1, GRID_SIDE + 1):
            if third_digit in (first_digit, second_digit):
                continue
            first_pincers = _xy_wing_pincers(
                values,
                candidates,
                pivot_peers,
                first_digit,
                third_digit,
            )
            second_pincers = _xy_wing_pincers(
                values,
                candidates,
                pivot_peers,
                second_digit,
                third_digit,
            )
            for first_pincer in first_pincers:
                for second_pincer in second_pincers:
                    if first_pincer == second_pincer:
                        continue
                    elimination_indices = set(
                        peer_indices(first_pincer) & peer_indices(second_pincer)
                    )
                    elimination_indices.discard(pivot_index)
                    elimination_indices.discard(first_pincer)
                    elimination_indices.discard(second_pincer)
                    elims = outside_digit_cells(
                        values,
                        candidates,
                        elimination_indices,
                        set(),
                        third_digit,
                    )
                    if not elims:
                        continue
                    cells = tuple(sorted((pivot_index, first_pincer, second_pincer)))
                    yield TechniqueStep(
                        technique=Technique.XY_WING,
                        outline_cells=cells,
                        focus_cells=cells,
                        digit=third_digit,
                        digits=tuple(sorted(candidates[pivot_index])),
                        elim_cells=elims,
                    )


def iter_xyz_wings(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for pivot_index, pivot_value in enumerate(values):
        if pivot_value != EMPTY_CELL:
            continue
        pivot_candidates = candidates[pivot_index]
        if len(pivot_candidates) != 3:
            continue
        pivot_peers = peer_indices(pivot_index)
        pincers = [
            index
            for index in pivot_peers
            if values[index] == EMPTY_CELL
            and len(candidates[index]) == 2
            and candidates[index] <= pivot_candidates
        ]
        for first_pincer, second_pincer in combinations(pincers, 2):
            first_pair = candidates[first_pincer]
            second_pair = candidates[second_pincer]
            if first_pair | second_pair != pivot_candidates:
                continue
            shared = first_pair & second_pair
            if len(shared) != 1:
                continue
            digit = next(iter(shared))
            elimination_indices = set(
                peer_indices(first_pincer) & peer_indices(second_pincer) & pivot_peers
            )
            elimination_indices.discard(pivot_index)
            elimination_indices.discard(first_pincer)
            elimination_indices.discard(second_pincer)
            elims = outside_digit_cells(
                values,
                candidates,
                elimination_indices,
                set(),
                digit,
            )
            if not elims:
                continue
            cells = tuple(sorted((pivot_index, first_pincer, second_pincer)))
            yield TechniqueStep(
                technique=Technique.XYZ_WING,
                outline_cells=cells,
                focus_cells=cells,
                digit=digit,
                digits=tuple(sorted(pivot_candidates)),
                elim_cells=elims,
            )


def iter_naked_pairs(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for house in HOUSES:
        groups: dict[frozenset[int], list[int]] = {}
        for index in house.cells:
            if values[index] != EMPTY_CELL:
                continue
            if len(candidates[index]) != 2:
                continue
            groups.setdefault(frozenset(candidates[index]), []).append(index)
        for cells in groups.values():
            if len(cells) != 2:
                continue
            digits = candidates[cells[0]]
            if not any(
                index not in cells
                and values[index] == EMPTY_CELL
                and bool(candidates[index] & digits)
                for index in house.cells
            ):
                continue
            focus = tuple(sorted(cells))
            yield TechniqueStep(
                technique=Technique.NAKED_PAIR,
                outline_cells=house.cells,
                focus_cells=focus,
                digits=tuple(sorted(digits)),
                house=house.kind,
                house_index=house.index,
                elim_cells=_outside_pair_cells(
                    values,
                    candidates,
                    house.cells,
                    focus,
                    frozenset(digits),
                ),
            )


def iter_hidden_pairs(
    values: list[int],
    candidates: list[set[int]],
) -> Iterator[TechniqueStep]:
    for house in HOUSES:
        empty_indices = [index for index in house.cells if values[index] == EMPTY_CELL]
        for first_digit in range(1, GRID_SIDE + 1):
            for second_digit in range(first_digit + 1, GRID_SIDE + 1):
                first_cells = {index for index in empty_indices if first_digit in candidates[index]}
                second_cells = {
                    index for index in empty_indices if second_digit in candidates[index]
                }
                if len(first_cells) != 2 or first_cells != second_cells:
                    continue
                if not any(
                    candidates[index] - {first_digit, second_digit} for index in first_cells
                ):
                    continue
                yield TechniqueStep(
                    technique=Technique.HIDDEN_PAIR,
                    outline_cells=house.cells,
                    focus_cells=tuple(sorted(first_cells)),
                    digits=(first_digit, second_digit),
                    house=house.kind,
                    house_index=house.index,
                )
