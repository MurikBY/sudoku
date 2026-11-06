import { useCallback, useRef, type Dispatch, type RefObject } from "react";

import { completeGame, moveCell, requestHint } from "@/api/games";
import type { CellNotesMap, Game, MoveCellResponse } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { MOVE_PEER_NOTES_DELAY_MS } from "@/hooks/useHintFlash";
import { formatApiErrorMessage, isRetryableApiError } from "@/lib/api/apiError";
import { queryRetryDelayMs } from "@/lib/api/queryLoadStatus";
import {
  cloneNotesMap,
  notesAfterDigitBeforePeerClear,
  peerNoteClearIndices,
  shouldAutoComplete,
} from "@/lib/play/boardNotes";
import { isGivenCell } from "@/lib/play/sudokuGrid";

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

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export const COMPLETION_CONNECTION_ERROR = "No connection.";

const COMPLETION_RETRY_LIMIT = 3;

async function completeGameRetrying(gameId: string, elapsedSeconds: number): Promise<Game> {
  let failureCount = 0;
  while (true) {
    try {
      return await completeGame(gameId, elapsedSeconds);
    } catch (completeError) {
      if (!isRetryableApiError(completeError) || failureCount >= COMPLETION_RETRY_LIMIT) {
        throw completeError;
      }
      await waitMs(queryRetryDelayMs(failureCount));
      failureCount += 1;
    }
  }
}

function completionFailureMessage(completeError: unknown): string {
  if (isRetryableApiError(completeError)) {
    return COMPLETION_CONNECTION_ERROR;
  }
  return formatApiErrorMessage(completeError);
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
  const applyBoardResultWithPeerNoteStage = useCallback(
    async (previousNotes: CellNotesMap, boardResult: MoveCellResponse, moveCell: number) => {
      const clearedPeers = peerNoteClearIndices(previousNotes, boardResult.notes, moveCell);
      if (clearedPeers.length === 0) {
        gameRef.current = boardResult;
        dispatch({ type: "replaceGame", game: boardResult });
        flashCells([moveCell]);
        return;
      }

      const interimResult = {
        ...boardResult,
        notes: notesAfterDigitBeforePeerClear(previousNotes, moveCell),
      };
      gameRef.current = interimResult;
      dispatch({ type: "replaceGame", game: interimResult });
      flashCells([moveCell]);
      await waitMs(MOVE_PEER_NOTES_DELAY_MS);
      gameRef.current = boardResult;
      dispatch({ type: "replaceGame", game: boardResult });
      flashCells(clearedPeers);
    },
    [dispatch, flashCells, gameRef],
  );

  const completionInFlightRef = useRef(false);

  const settleCompletedGame = useCallback(
    async (gameId: string, elapsedSeconds: number) => {
      dispatch({ type: "clearError" });
      dispatch({ type: "setPhase", phase: "completing" });
      try {
        const completedGame = await completeGameRetrying(gameId, elapsedSeconds);
        gameRef.current = completedGame;
        dispatch({ type: "storeGame", game: completedGame });
        dispatch({ type: "clearSelection" });
        dispatch({ type: "setPhase", phase: "completed" });
        onGameStateChanged();
        return completedGame;
      } catch (completeError) {
        dispatch({ type: "setPhase", phase: "playing" });
        dispatch({ type: "setError", error: completionFailureMessage(completeError) });
        return null;
      }
    },
    [dispatch, gameRef, onGameStateChanged],
  );

  // applyMove is already on the board queue, so this attempt must not enqueue again.
  const finishCompletedGame = useCallback(
    async (gameId: string, elapsedSeconds: number) => {
      if (completionInFlightRef.current) {
        return null;
      }
      completionInFlightRef.current = true;
      try {
        return await settleCompletedGame(gameId, elapsedSeconds);
      } finally {
        completionInFlightRef.current = false;
      }
    },
    [settleCompletedGame],
  );

  const enqueueFinishCompletedGame = useCallback(
    (gameId: string, elapsedSeconds: number): Promise<Game | null> => {
      if (completionInFlightRef.current) {
        return Promise.resolve(null);
      }
      completionInFlightRef.current = true;
      return enqueueBoardAction(() => settleCompletedGame(gameId, elapsedSeconds)).finally(() => {
        completionInFlightRef.current = false;
      });
    },
    [enqueueBoardAction, settleCompletedGame],
  );

  const applyMove = useCallback(
    (value: number, elapsedSeconds: number, cellIndexOverride?: number) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        const targetIndex = cellIndexOverride ?? selectedIndexRef.current;
        if (targetIndex === null || currentGame.status !== "in_progress") {
          return null;
        }
        if (isGivenCell(currentGame.puzzle, targetIndex)) {
          return null;
        }

        const cellIndex = targetIndex;
        const previousNotes = cloneNotesMap(currentGame.notes);

        dispatch({ type: "clearError" });
        try {
          const moveResult = await moveCell(currentGame.id, cellIndex, value, elapsedSeconds);
          await applyBoardResultWithPeerNoteStage(previousNotes, moveResult, cellIndex);

          if (shouldAutoComplete(moveResult)) {
            return finishCompletedGame(moveResult.id, elapsedSeconds);
          }

          return moveResult;
        } catch (moveError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(moveError) });
          return null;
        }
      }),
    [
      applyBoardResultWithPeerNoteStage,
      dispatch,
      enqueueBoardAction,
      finishCompletedGame,
      gameRef,
      selectedIndexRef,
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
          gameRef.current = hintResult;
          dispatch({ type: "replaceGame", game: hintResult });
          return hintResult;
        } catch (hintError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(hintError) });
          return null;
        } finally {
          setHintPending(false);
        }
      }),
    [dispatch, enqueueBoardAction, gameRef, setHintPending],
  );

  return { applyMove, applyCoachHint, finishCompletedGame: enqueueFinishCompletedGame };
}
