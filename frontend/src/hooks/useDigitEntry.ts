import { useCallback } from "react";

import type { Game } from "@/api/types";
import type { useLatestBoardCells } from "@/hooks/useLatestBoardCells";
import { applyServerElapsed } from "@/lib/play/applyServerElapsed";
import { isCorrectDigitLocked } from "@/lib/play/sudokuGrid";

type UseDigitEntryArgs = {
  latest: ReturnType<typeof useLatestBoardCells>;
  mistakes: {
    feedback: boolean;
    wrongDigitIndices: ReadonlySet<number>;
    trigger: (cellIndex: number) => void;
  };
  applyMove: (
    value: number,
    elapsedSeconds: number,
    cellIndex?: number,
  ) => Promise<(Game & { is_mistake?: boolean }) | null>;
  toggleNote: (digit: number, elapsedSeconds: number, cellIndex?: number) => Promise<Game | null>;
  elapsed: {
    getElapsedSeconds: () => number;
    setElapsedFromServer: (elapsedSeconds: number) => void;
  };
};

// A digit on a cell is a note in pencil mode and a move otherwise. A correct digit stays
// locked while mistake feedback is on.
export function useDigitEntry({
  latest,
  mistakes,
  applyMove,
  toggleNote,
  elapsed,
}: UseDigitEntryArgs) {
  const { puzzleRef, currentGridRef, pencilModeRef } = latest;
  const { feedback, wrongDigitIndices, trigger } = mistakes;
  const { getElapsedSeconds, setElapsedFromServer } = elapsed;

  return useCallback(
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
      currentGridRef,
      feedback,
      getElapsedSeconds,
      pencilModeRef,
      puzzleRef,
      setElapsedFromServer,
      toggleNote,
      trigger,
      wrongDigitIndices,
    ],
  );
}
