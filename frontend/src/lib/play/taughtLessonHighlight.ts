import type { TaughtLessonSnapshot } from "@/api/types";
import type { CoachHint, CoachHouse, CoachTechnique } from "@/lib/play/coachHint";
import { boxIndex, rowCol } from "@/lib/play/sudokuGrid";

export type TaughtHouseRing = { kind: CoachHouse; index: number };

const COACH_TECHNIQUES: readonly CoachTechnique[] = [
  "naked_single",
  "hidden_single",
  "naked_pair",
  "hidden_pair",
  "pointing_pair",
  "box_line_reduction",
  "x_wing",
  "swordfish",
  "xy_wing",
  "xyz_wing",
];

const COACH_HOUSES: readonly CoachHouse[] = ["row", "col", "box"];

export function taughtLessonHighlight(snapshot: TaughtLessonSnapshot): {
  outline: Set<number>;
  elim: Set<number>;
  houses: TaughtHouseRing[];
} {
  const hint = taughtSnapshotCoachHint(snapshot);
  const focus = new Set(hint.focus_cells);
  return {
    outline: focus,
    elim: new Set(hint.elim_cells.filter((index) => !focus.has(index))),
    houses: taughtHouseRings(hint),
  };
}

function taughtHouseRings(hint: CoachHint): TaughtHouseRing[] {
  const rings: TaughtHouseRing[] = [];
  if (hint.house !== null && hint.house_index !== null) {
    rings.push({ kind: hint.house, index: hint.house_index });
  }
  if (hint.technique !== "naked_pair" && hint.technique !== "box_line_reduction") {
    return rings;
  }
  for (const shared of housesSharedByCells(hint.focus_cells)) {
    if (!rings.some((ring) => ring.kind === shared.kind && ring.index === shared.index)) {
      rings.push(shared);
    }
  }
  return rings;
}

function housesSharedByCells(indices: readonly number[]): TaughtHouseRing[] {
  const first = indices[0];
  if (first === undefined) {
    throw new Error("housesSharedByCells: empty indices");
  }
  const firstCell = rowCol(first);
  const shared: TaughtHouseRing[] = [];
  if (indices.every((index) => rowCol(index).row === firstCell.row)) {
    shared.push({ kind: "row", index: firstCell.row });
  }
  if (indices.every((index) => rowCol(index).col === firstCell.col)) {
    shared.push({ kind: "col", index: firstCell.col });
  }
  const firstBox = boxIndex(firstCell.row, firstCell.col);
  if (
    indices.every((index) => {
      const cell = rowCol(index);
      return boxIndex(cell.row, cell.col) === firstBox;
    })
  ) {
    shared.push({ kind: "box", index: firstBox });
  }
  return shared;
}

function taughtSnapshotCoachHint(
  snapshot: Pick<TaughtLessonSnapshot, "technique" | "step" | "notes_issue">,
): CoachHint {
  if (snapshot.notes_issue !== null) {
    return {
      kind: "notes",
      hints_count: 0,
      elapsed_seconds: 0,
      error_indices: [],
      technique: null,
      house: parseCoachHouse(snapshot.notes_issue.house ?? null),
      house_index: snapshot.notes_issue.house_index ?? null,
      outline_cells: snapshot.notes_issue.outline_cells,
      focus_cells: [snapshot.notes_issue.cell_index],
      elim_cells: [],
      digit: snapshot.notes_issue.digit ?? null,
      digits: snapshot.notes_issue.digits,
      notes_issue: snapshot.notes_issue.kind,
    };
  }
  if (snapshot.step === null) {
    throw new Error(`taught snapshot missing step: ${snapshot.technique}`);
  }
  return {
    kind: "technique",
    hints_count: 0,
    elapsed_seconds: 0,
    error_indices: [],
    technique: parseCoachTechnique(snapshot.step.technique),
    house: parseCoachHouse(snapshot.step.house ?? null),
    house_index: snapshot.step.house_index ?? null,
    outline_cells: snapshot.step.outline_cells,
    focus_cells: snapshot.step.focus_cells,
    elim_cells: snapshot.step.elim_cells,
    digit: snapshot.step.digit ?? null,
    digits: snapshot.step.digits,
    notes_issue: null,
  };
}

function parseCoachTechnique(value: string): CoachTechnique {
  if ((COACH_TECHNIQUES as readonly string[]).includes(value)) {
    return value as CoachTechnique;
  }
  throw new Error(`unknown taught step technique: ${value}`);
}

function parseCoachHouse(value: string | null): CoachHouse | null {
  if (value === null) {
    return null;
  }
  if ((COACH_HOUSES as readonly string[]).includes(value)) {
    return value as CoachHouse;
  }
  throw new Error(`unknown taught step house: ${value}`);
}
