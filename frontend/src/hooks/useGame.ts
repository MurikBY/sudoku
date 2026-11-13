import { useCallback, useReducer, useState } from "react";

import type { Game } from "@/api/types";
import { boardReducer, initialBoardState } from "@/hooks/boardState";
import { useBoardActionQueue } from "@/hooks/useBoardActionQueue";
import { useBoardMoves } from "@/hooks/useBoardMoves";
import { useLatestBoardRefs } from "@/hooks/useLatestBoardRefs";
import { useNotes } from "@/hooks/useNotes";
import { useUndo } from "@/hooks/useUndo";

type UseGameOptions = {
  initialGame: Game;
  onGameStateChanged?: () => void;
  onCellsFlash?: (cells: readonly number[]) => void;
};

export function useGame({ initialGame, onGameStateChanged, onCellsFlash }: UseGameOptions) {
  const [board, dispatch] = useReducer(boardReducer, initialGame, initialBoardState);
  const [isHintPending, setIsHintPending] = useState(false);
  const [isUndoPending, setIsUndoPending] = useState(false);
  const { enqueueBoardAction, isBoardActionPending } = useBoardActionQueue();
  const { gameRef, selectedIndexRef } = useLatestBoardRefs(board.game, board.selectedIndex);

  const notifyGameStateChanged = useCallback(() => {
    onGameStateChanged?.();
  }, [onGameStateChanged]);

  const flashCells = useCallback(
    (cells: readonly number[]) => {
      if (cells.length === 0) {
        return;
      }
      onCellsFlash?.(cells);
    },
    [onCellsFlash],
  );

  const { applyMove, applyCoachHint, finishCompletedGame } = useBoardMoves({
    enqueueBoardAction,
    gameRef,
    selectedIndexRef,
    dispatch,
    flashCells,
    setHintPending: setIsHintPending,
    onGameStateChanged: notifyGameStateChanged,
  });

  const { toggleNote, addNote, clearNotes } = useNotes({
    enqueueBoardAction,
    gameRef,
    selectedIndexRef,
    dispatch,
  });

  const { undoLastMove } = useUndo({
    enqueueBoardAction,
    gameRef,
    dispatch,
    flashCells,
    setUndoPending: setIsUndoPending,
  });

  const selectCell = useCallback((index: number | null) => {
    dispatch({ type: "select", index });
  }, []);

  const togglePencilMode = useCallback(() => {
    dispatch({ type: "togglePencil" });
  }, []);

  return {
    board: {
      phase: board.phase,
      game: board.game,
      error: board.error,
      selectedIndex: board.selectedIndex,
      isPencilMode: board.isPencilMode,
      conflictIndices: board.conflictIndices,
      wrongDigitIndices: board.wrongDigitIndices,
      canUndo: board.game.undo_count > 0,
    },
    pending: {
      isMovePending: isBoardActionPending,
      isHintPending,
      isNotesPending: isBoardActionPending,
      isUndoPending,
    },
    actions: {
      selectCell,
      togglePencilMode,
      applyMove,
      applyCoachHint,
      finishCompletedGame,
      toggleNote,
      addNote,
      clearNotes,
      undoLastMove,
      clearError: () => dispatch({ type: "clearError" }),
    },
  };
}
