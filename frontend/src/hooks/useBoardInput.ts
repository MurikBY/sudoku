import { useCallback, type RefObject } from "react";

import { type CellNotesMap, type Game } from "@/api/types";
import { useDigitEntry } from "@/hooks/useDigitEntry";
import { useLatestBoardCells } from "@/hooks/useLatestBoardCells";
import { applyServerElapsed } from "@/lib/play/applyServerElapsed";
import {
  cellDigitValue,
  isCorrectDigitLocked,
  isGivenCell,
  notesForCell,
} from "@/lib/play/sudokuGrid";

type TimedBoard = { elapsed_seconds: number };

type BoardCommands = {
  applyMove: (
    value: number,
    elapsedSeconds: number,
    cellIndex?: number,
  ) => Promise<(Game & { is_mistake?: boolean }) | null>;
  toggleNote: (digit: number, elapsedSeconds: number, cellIndex?: number) => Promise<Game | null>;
  clearNotes: (elapsedSeconds: number) => Promise<Game | null>;
  undoLastMove: (elapsedSeconds: number) => Promise<TimedBoard | null>;
  selectCell: (index: number | null) => void;
};

type UseBoardInputArgs = {
  gates: {
    canUsePad: boolean;
    canClear: boolean;
    padCompletedDigits: ReadonlySet<number>;
  };
  selection: {
    selectedIndex: number | null;
    isPencilMode: boolean;
  };
  cells: {
    puzzle: string;
    currentGrid: string;
    notes: CellNotesMap;
  };
  mistakes: {
    feedback: boolean;
    wrongDigitIndices: ReadonlySet<number>;
    trigger: (cellIndex: number) => void;
  };
  commands: BoardCommands;
  sticky: {
    digit: number | null;
    digitRef: RefObject<number | null>;
    clear: () => void;
    assist: boolean;
  };
  elapsed: {
    getElapsedSeconds: () => number;
    setElapsedFromServer: (elapsedSeconds: number) => void;
  };
  prepareGesture: () => void;
};

// Clear removes notes in pencil mode or from a cell that has only notes, and the digit otherwise.
function clearTarget(
  cells: UseBoardInputArgs["cells"],
  cellIndex: number,
  isPencilMode: boolean,
  mistakes: Pick<UseBoardInputArgs["mistakes"], "feedback" | "wrongDigitIndices">,
): "notes" | "digit" | "locked" {
  const { puzzle, currentGrid, notes } = cells;
  if (
    isCorrectDigitLocked(
      puzzle,
      currentGrid,
      cellIndex,
      mistakes.wrongDigitIndices,
      mistakes.feedback,
    )
  ) {
    return "locked";
  }
  const hasDigit = cellDigitValue(currentGrid, cellIndex) !== null;
  const hasNotes = notesForCell(notes, cellIndex).length > 0;
  return isPencilMode || (!hasDigit && hasNotes) ? "notes" : "digit";
}

export function useBoardInput({
  gates,
  selection,
  cells,
  mistakes,
  commands,
  sticky,
  elapsed,
  prepareGesture,
}: UseBoardInputArgs) {
  const { canUsePad, canClear, padCompletedDigits } = gates;
  const { selectedIndex, isPencilMode } = selection;
  const { puzzle, currentGrid } = cells;
  const { applyMove, toggleNote, clearNotes, undoLastMove, selectCell } = commands;
  const { getElapsedSeconds, setElapsedFromServer } = elapsed;
  const latest = useLatestBoardCells(puzzle, currentGrid, isPencilMode);
  const { puzzleRef, currentGridRef } = latest;
  const applyDigitAtCell = useDigitEntry({ latest, mistakes, applyMove, toggleNote, elapsed });

  const handleUndo = useCallback(async () => {
    prepareGesture();
    const result = await undoLastMove(getElapsedSeconds());
    applyServerElapsed(result, setElapsedFromServer);
  }, [getElapsedSeconds, prepareGesture, setElapsedFromServer, undoLastMove]);

  async function handlePick(digit: number) {
    if (padCompletedDigits.has(digit)) {
      return;
    }
    prepareGesture();
    if (sticky.digit !== null) {
      sticky.clear();
      return;
    }
    if (!canUsePad || selectedIndex === null) {
      return;
    }
    await applyDigitAtCell(digit, selectedIndex);
  }

  function handleSelectCell(index: number) {
    prepareGesture();
    const lockedDigit = sticky.assist ? sticky.digitRef.current : null;
    if (lockedDigit !== null) {
      if (isGivenCell(puzzleRef.current, index)) {
        return;
      }
      if (cellDigitValue(currentGridRef.current, index) !== null) {
        return;
      }
      selectCell(index);
      void applyDigitAtCell(lockedDigit, index);
      return;
    }
    selectCell(index);
  }

  async function handleClear() {
    if (!canClear) {
      return;
    }
    prepareGesture();
    sticky.clear();
    if (selectedIndex === null) {
      return;
    }
    const target = clearTarget(cells, selectedIndex, isPencilMode, mistakes);
    if (target === "locked") {
      return;
    }
    const result =
      target === "notes"
        ? await clearNotes(getElapsedSeconds())
        : await applyMove(0, getElapsedSeconds());
    applyServerElapsed(result, setElapsedFromServer);
  }

  return { handlePick, handleClear, handleSelectCell, handleUndo };
}
