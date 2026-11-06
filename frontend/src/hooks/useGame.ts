import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { abandonGame, createGame, syncGameProgress } from "@/api/games";
import type { Difficulty, Game } from "@/api/types";
import { boardReducer, initialBoardState } from "@/hooks/boardState";
import { useBoardMoves } from "@/hooks/useBoardMoves";
import { useNotes } from "@/hooks/useNotes";
import { useUndo } from "@/hooks/useUndo";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { bestEffort } from "@/lib/api/bestEffort";

type UseGameOptions = {
  initialGame: Game;
  onGameStateChanged?: () => void;
  onCellsFlash?: (cells: readonly number[]) => void;
};

export function useGame({ initialGame, onGameStateChanged, onCellsFlash }: UseGameOptions) {
  const [board, dispatch] = useReducer(boardReducer, initialGame, initialBoardState);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isGivingUp, setIsGivingUp] = useState(false);
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

  const startNewGame = useCallback(
    async (difficulty: Difficulty) => {
      setIsCreatingGame(true);
      dispatch({ type: "clearError" });
      try {
        if (board.game.status === "in_progress") {
          await bestEffort("create_game abandons using last synced elapsed", () =>
            syncGameProgress(board.game.id, board.game.elapsed_seconds),
          );
        }
        const newGame = await createGame(difficulty);
        dispatch({ type: "storeGame", game: newGame });
        dispatch({ type: "clearSelection" });
        dispatch({ type: "setPencil", pencil: false });
        dispatch({ type: "setPhase", phase: "playing" });
        notifyGameStateChanged();
        return newGame;
      } catch (createError) {
        dispatch({ type: "setError", error: formatApiErrorMessage(createError) });
        return null;
      } finally {
        setIsCreatingGame(false);
      }
    },
    [
      board.game.elapsed_seconds,
      board.game.id,
      board.game.status,
      dispatch,
      notifyGameStateChanged,
    ],
  );

  const giveUpGame = useCallback(
    async (elapsedSeconds: number) => {
      if (board.game.status !== "in_progress") {
        return false;
      }
      setIsGivingUp(true);
      dispatch({ type: "clearError" });
      try {
        await abandonGame(board.game.id, elapsedSeconds);
        dispatch({ type: "clearSelection" });
        notifyGameStateChanged();
        return true;
      } catch (giveUpError) {
        dispatch({ type: "setError", error: formatApiErrorMessage(giveUpError) });
        return false;
      } finally {
        setIsGivingUp(false);
      }
    },
    [board.game, dispatch, notifyGameStateChanged],
  );

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
      isCreatingGame,
      isGivingUp,
      isMovePending,
      isHintPending,
      isNotesPending,
      isUndoPending,
    },
    actions: {
      startNewGame,
      giveUpGame,
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
