import type { CellNotesMap, HintResponse } from "@/api/types";

type CoachHintKind = "mistake" | "notes" | "technique";

export type CoachHouse = "row" | "col" | "box";

export type CoachTechnique =
  | "naked_single"
  | "hidden_single"
  | "naked_pair"
  | "hidden_pair"
  | "pointing_pair"
  | "box_line_reduction"
  | "x_wing"
  | "swordfish"
  | "xy_wing"
  | "xyz_wing";

const NOTES_ISSUES = ["illegal", "empty", "incomplete"] as const;

type NotesIssueKind = (typeof NOTES_ISSUES)[number];

function parseNotesIssue(value: string | null): NotesIssueKind | null {
  if (value === null) {
    return null;
  }
  if ((NOTES_ISSUES as readonly string[]).includes(value)) {
    return value as NotesIssueKind;
  }
  throw new Error(`unknown notes_issue: ${value}`);
}

export type CoachHint = {
  kind: CoachHintKind;
  hints_count: number;
  elapsed_seconds: number;
  error_indices: number[];
  technique: CoachTechnique | null;
  house: CoachHouse | null;
  house_index: number | null;
  outline_cells: number[];
  focus_cells: number[];
  elim_cells: number[];
  digit: number | null;
  digits: number[];
  notes_issue: NotesIssueKind | null;
};

export function coachHintFromResponse(response: HintResponse): CoachHint {
  if (response.kind !== "mistake" && response.kind !== "notes" && response.kind !== "technique") {
    throw new Error(`unknown coach hint kind: ${response.kind}`);
  }
  return {
    kind: response.kind,
    hints_count: response.hints_count,
    elapsed_seconds: response.elapsed_seconds,
    error_indices: response.error_indices,
    technique: response.technique,
    house: response.house,
    house_index: response.house_index,
    outline_cells: response.outline_cells,
    focus_cells: response.focus_cells,
    elim_cells: response.elim_cells,
    digit: response.digit,
    digits: response.digits,
    notes_issue: parseNotesIssue(response.notes_issue),
  };
}

export function coachEpisodeFingerprint(grid: string, notes: CellNotesMap): string {
  const keys = Object.keys(notes).sort((left, right) => Number(left) - Number(right));
  const notesPart = keys
    .map((key) => {
      const digits = notes[key];
      if (digits === undefined) {
        throw new Error(`missing notes for cell ${key}`);
      }
      return `${key}:${digits.join(",")}`;
    })
    .join(";");
  return `${grid}|${notesPart}`;
}
