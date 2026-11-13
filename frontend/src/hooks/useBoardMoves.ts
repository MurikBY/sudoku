import { useCallback, type Dispatch, type RefObject } from "react";

import { moveCell, requestHint } from "@/api/games";
import type { CellNotesMap, Game, MoveCellResponse } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { useGameCompletion } from "@/hooks/useGameCompletion";
import { MOVE_PEER_NOTES_DELAY_MS } from "@/hooks/useHintFlash";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import {
  cloneNotesMap,
  notesAfterDigitBeforePeerClear,
  peerNoteClearIndices,
  shouldAutoComplete,
} from "@/lib/play/boardNotes";
import { isGivenCell } from "@/lib/play/sudokuGrid";
import { waitMs } from "@/lib/waitMs";

type EnqueueBoardAction = <T>(action: () => Promise<T>) => Promise<T>;

type UseBoardMovesArgs = {
  enqueueBoardAction: EnqueueBoardAction;
  gameRef: RefObject<Game>;
  selectedIndexRef: RefObject<number | null>;
  dispatch: Dispatch<BoardAction>;
  flashCells: (cells: readonly number[]) => void;
  setHintPending: (pending: boolean) => void;
  onGameStateChanged: () => void;
};

function isEditableCell(game: Game, cellIndex: number | null): cellIndex is number {
  return (
    cellIndex !== null && game.status === "in_progress" && !isGivenCell(game.puzzle, cellIndex)
  );
}

type MoveDisplay = {
  showGame: (game: Game) => void;
  flashCells: (cells: readonly number[]) => void;
};

// When a digit clears peer notes, the digit shows first and the cleared notes go a beat later.
async function showMoveResult(
  previousNotes: CellNotesMap,
  boardResult: MoveCellResponse,
  moveCell: number,
  display: MoveDisplay,
) {
  const clearedPeers = peerNoteClearIndices(previousNotes, boardResult.notes, moveCell);
  if (clearedPeers.length === 0) {
    display.showGame(boardResult);
    display.flashCells([moveCell]);
    return;
  }
  display.showGame({
    ...boardResult,
    notes: notesAfterDigitBeforePeerClear(previousNotes, moveCell),
  });
  display.flashCells([moveCell]);
  await waitMs(MOVE_PEER_NOTES_DELAY_MS);
  display.showGame(boardResult);
  display.flashCells(clearedPeers);
}

export function useBoardMoves({
  enqueueBoardAction,
  gameRef,
  selectedIndexRef,
  dispatch,
  flashCells,
  setHintPending,
  onGameStateChanged,
}: UseBoardMovesArgs) {
  const { finishFromQueue, enqueueFinish } = useGameCompletion({
    enqueueBoardAction,
    gameRef,
    dispatch,
    onGameStateChanged,
  });

  const showGame = useCallback(
    (game: Game) => {
      gameRef.current = game;
      dispatch({ type: "replaceGame", game });
    },
    [dispatch, gameRef],
  );

  const applyMove = useCallback(
    (value: number, elapsedSeconds: number, cellIndexOverride?: number) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        const cellIndex = cellIndexOverride ?? selectedIndexRef.current;
        if (!isEditableCell(currentGame, cellIndex)) {
          return null;
        }
        const previousNotes = cloneNotesMap(currentGame.notes);
        dispatch({ type: "clearError" });
        try {
          const moveResult = await moveCell(currentGame.id, cellIndex, value, elapsedSeconds);
          await showMoveResult(previousNotes, moveResult, cellIndex, { showGame, flashCells });
          if (shouldAutoComplete(moveResult)) {
            return finishFromQueue(moveResult.id, elapsedSeconds);
          }
          return moveResult;
        } catch (moveError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(moveError) });
          return null;
        }
      }),
    [
      dispatch,
      enqueueBoardAction,
      finishFromQueue,
      flashCells,
      gameRef,
      selectedIndexRef,
      showGame,
    ],
  );

  const applyCoachHint = useCallback(
    (elapsedSeconds: number) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        if (currentGame.status !== "in_progress") {
          return null;
        }
        setHintPending(true);
        dispatch({ type: "clearError" });
        try {
          const hintResult = await requestHint(currentGame.id, elapsedSeconds);
          showGame(hintResult);
          return hintResult;
        } catch (hintError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(hintError) });
          return null;
        } finally {
          setHintPending(false);
        }
      }),
    [dispatch, enqueueBoardAction, gameRef, setHintPending, showGame],
  );

  return { applyMove, applyCoachHint, finishCompletedGame: enqueueFinish };
}
