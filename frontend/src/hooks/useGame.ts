import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { Game } from "@/api/types";
import { boardReducer, initialBoardState } from "@/hooks/boardState";
import { useBoardMoves } from "@/hooks/useBoardMoves";
import { useNotes } from "@/hooks/useNotes";
import { useUndo } from "@/hooks/useUndo";

type UseGameOptions = {
  initialGame: Game;
  onGameStateChanged?: () => void;
  onCellsFlash?: (cells: readonly number[]) => void;
};

export function useGame({ initialGame, onGameStateChanged, onCellsFlash }: UseGameOptions) {
  const [board, dispatch] = useReducer(boardReducer, initialGame, initialBoardState);
  const [isMovePending, setIsMovePending] = useState(false);
  const [isHintPending, setIsHintPending] = useState(false);
  const [isNotesPending, setIsNotesPending] = useState(false);
  const [isUndoPending, setIsUndoPending] = useState(false);
  const gameRef = useRef(board.game);
  const selectedIndexRef = useRef(board.selectedIndex);
  const boardActionChainRef = useRef(Promise.resolve());
  const boardActionPendingCountRef = useRef(0);

  useEffect(() => {
    gameRef.current = board.game;
    selectedIndexRef.current = board.selectedIndex;
  }, [board.game, board.selectedIndex]);

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

  const enqueueBoardAction = useCallback(<T>(action: () => Promise<T>): Promise<T> => {
    const run = async () => {
      boardActionPendingCountRef.current += 1;
      setIsMovePending(true);
      setIsNotesPending(true);
      try {
        return await action();
      } finally {
        boardActionPendingCountRef.current -= 1;
        if (boardActionPendingCountRef.current === 0) {
          setIsMovePending(false);
          setIsNotesPending(false);
        }
      }
    };
    const queued = boardActionChainRef.current.then(run, run);
    boardActionChainRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

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
      isMovePending,
      isHintPending,
      isNotesPending,
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
