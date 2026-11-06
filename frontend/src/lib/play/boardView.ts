import { type CellNotesMap } from "@/api/types";
import {
  cellDigitValue,
  completedDigits,
  isCorrectDigitLocked,
  isGivenCell,
  notesForCell,
} from "@/lib/play/sudokuGrid";

export type BoardViewInput = {
  puzzle: string;
  currentGrid: string;
  notes: CellNotesMap;
  dimCompletedDigits: boolean;
  mistakeFeedback: boolean;
  stickyAssist: boolean;
  isPlaying: boolean;
  showLessonSuccess: boolean;
  selectedIndex: number | null;
  isPencilMode: boolean;
  conflictIndices: ReadonlySet<number>;
  wrongDigitIndices: ReadonlySet<number>;
  stickyDigit: number | null;
};

type BoardView = {
  canUsePad: boolean;
  canClear: boolean;
  canHint: boolean;
  activeDigit: number | null;
  noteDigits: Set<number>;
  padCompletedDigits: Set<number>;
  visibleWrongDigitIndices: ReadonlySet<number>;
  notePaintEnabled: boolean;
};

export function completedPadDigits(
  currentGrid: string,
  conflictIndices: ReadonlySet<number>,
  wrongDigitIndices: ReadonlySet<number>,
  dimCompletedDigits: boolean,
): Set<number> {
  if (!dimCompletedDigits) {
    return new Set();
  }
  return completedDigits(currentGrid, conflictIndices, wrongDigitIndices);
}

export function boardView(input: BoardViewInput): BoardView {
  const padCompletedDigits = completedPadDigits(
    input.currentGrid,
    input.conflictIndices,
    input.wrongDigitIndices,
    input.dimCompletedDigits,
  );
  const selectedIsEmptyEditable =
    input.isPlaying &&
    input.selectedIndex !== null &&
    !isGivenCell(input.puzzle, input.selectedIndex) &&
    cellDigitValue(input.currentGrid, input.selectedIndex) === null;
  const canUsePad =
    input.isPlaying &&
    !input.showLessonSuccess &&
    input.selectedIndex !== null &&
    !isGivenCell(input.puzzle, input.selectedIndex) &&
    (!input.isPencilMode || selectedIsEmptyEditable);
  const canClear =
    input.isPlaying &&
    input.selectedIndex !== null &&
    !isGivenCell(input.puzzle, input.selectedIndex) &&
    (cellDigitValue(input.currentGrid, input.selectedIndex) !== null ||
      notesForCell(input.notes, input.selectedIndex).length > 0) &&
    !isCorrectDigitLocked(
      input.puzzle,
      input.currentGrid,
      input.selectedIndex,
      input.wrongDigitIndices,
      input.mistakeFeedback,
    );
  const activeDigit =
    input.selectedIndex !== null ? cellDigitValue(input.currentGrid, input.selectedIndex) : null;
  const noteDigits =
    input.selectedIndex !== null
      ? new Set(notesForCell(input.notes, input.selectedIndex))
      : new Set<number>();

  return {
    canUsePad,
    canClear,
    canHint: input.isPlaying && !input.showLessonSuccess,
    activeDigit,
    noteDigits,
    padCompletedDigits,
    visibleWrongDigitIndices: input.mistakeFeedback ? input.wrongDigitIndices : new Set<number>(),
    notePaintEnabled:
      input.isPlaying && input.isPencilMode && input.stickyAssist && input.stickyDigit !== null,
  };
}
