import type { CellNotesMap, MoveCellResponse } from "@/api/types";
import { isGridFilled, peerIndices } from "@/lib/play/sudokuGrid";

export function cloneNotesMap(notes: CellNotesMap): CellNotesMap {
  const cloned: CellNotesMap = {};
  for (const [cellKey, digits] of Object.entries(notes)) {
    cloned[cellKey] = [...digits];
  }
  return cloned;
}

export function notesWithCellDigits(
  notes: CellNotesMap,
  cellIndex: number,
  digits: readonly number[],
): CellNotesMap {
  const nextNotes = { ...notes };
  const cellKey = String(cellIndex);
  if (digits.length === 0) {
    delete nextNotes[cellKey];
  } else {
    nextNotes[cellKey] = [...digits];
  }
  return nextNotes;
}

export function notesAfterDigitBeforePeerClear(
  previousNotes: CellNotesMap,
  moveCell: number,
): CellNotesMap {
  const nextNotes = { ...previousNotes };
  delete nextNotes[String(moveCell)];
  return nextNotes;
}

export function peerNoteClearIndices(
  previousNotes: CellNotesMap,
  nextNotes: CellNotesMap,
  moveCell: number,
): number[] {
  const changed: number[] = [];
  for (const peerIndex of peerIndices(moveCell)) {
    const key = String(peerIndex);
    const before = JSON.stringify(previousNotes[key] ?? []);
    const after = JSON.stringify(nextNotes[key] ?? []);
    if (before !== after) {
      changed.push(peerIndex);
    }
  }
  return changed;
}

export function shouldAutoComplete(
  boardResult: Pick<MoveCellResponse, "current_grid" | "conflict_indices" | "wrong_digit_indices">,
): boolean {
  return (
    isGridFilled(boardResult.current_grid) &&
    boardResult.conflict_indices.length === 0 &&
    boardResult.wrong_digit_indices.length === 0
  );
}
