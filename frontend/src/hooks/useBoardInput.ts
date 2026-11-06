import { useCallback, useEffect, useRef, type RefObject } from "react";

import { type CellNotesMap, type Game } from "@/api/types";
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
  const { puzzle, currentGrid, notes } = cells;
  const { feedback, wrongDigitIndices, trigger } = mistakes;
  const { applyMove, toggleNote, clearNotes, undoLastMove, selectCell } = commands;
  const { getElapsedSeconds, setElapsedFromServer } = elapsed;
  const puzzleRef = useRef(puzzle);
  const currentGridRef = useRef(currentGrid);
  const pencilModeRef = useRef(isPencilMode);

  useEffect(() => {
    puzzleRef.current = puzzle;
    currentGridRef.current = currentGrid;
    pencilModeRef.current = isPencilMode;
  }, [currentGrid, isPencilMode, puzzle]);

  const applyDigitAtCell = useCallback(
    async (digit: number, cellIndex: number) => {
      if (pencilModeRef.current) {
        const result = await toggleNote(digit, getElapsedSeconds(), cellIndex);
        applyServerElapsed(result, setElapsedFromServer);
        return;
      }
      if (
        isCorrectDigitLocked(
          puzzleRef.current,
          currentGridRef.current,
          cellIndex,
          wrongDigitIndices,
          feedback,
        )
      ) {
        return;
      }
      const result = await applyMove(digit, getElapsedSeconds(), cellIndex);
      if (feedback && result && "is_mistake" in result && result.is_mistake) {
        trigger(cellIndex);
      }
      applyServerElapsed(result, setElapsedFromServer);
    },
    [
      applyMove,
      feedback,
      getElapsedSeconds,
      setElapsedFromServer,
      toggleNote,
      trigger,
      wrongDigitIndices,
    ],
  );

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
    if (isCorrectDigitLocked(puzzle, currentGrid, selectedIndex, wrongDigitIndices, feedback)) {
      return;
    }
    const hasDigit = cellDigitValue(currentGrid, selectedIndex) !== null;
    const hasNotes = notesForCell(notes, selectedIndex).length > 0;
    if (isPencilMode || (!hasDigit && hasNotes)) {
      const result = await clearNotes(getElapsedSeconds());
      applyServerElapsed(result, setElapsedFromServer);
      return;
    }
    const result = await applyMove(0, getElapsedSeconds());
    applyServerElapsed(result, setElapsedFromServer);
  }

  return {
    handlePick,
    handleClear,
    handleSelectCell,
    handleUndo,
  };
}
