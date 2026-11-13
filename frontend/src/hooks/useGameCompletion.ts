import { useCallback, useRef, type Dispatch, type RefObject } from "react";

import { completeGame } from "@/api/games";
import type { Game } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { formatApiErrorMessage, isRetryableApiError } from "@/lib/api/apiError";
import { queryRetryDelayMs } from "@/lib/api/queryLoadStatus";
import { waitMs } from "@/lib/waitMs";

export const COMPLETION_CONNECTION_ERROR = "No connection.";

const COMPLETION_RETRY_LIMIT = 3;

type EnqueueBoardAction = <T>(action: () => Promise<T>) => Promise<T>;

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

type UseGameCompletionArgs = {
  enqueueBoardAction: EnqueueBoardAction;
  gameRef: RefObject<Game>;
  dispatch: Dispatch<BoardAction>;
  onGameStateChanged: () => void;
};

// One completion at a time: the move that fills the board, or the retry button after it failed.
export function useGameCompletion({
  enqueueBoardAction,
  gameRef,
  dispatch,
  onGameStateChanged,
}: UseGameCompletionArgs) {
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
  const finishFromQueue = useCallback(
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

  const enqueueFinish = useCallback(
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

  return { finishFromQueue, enqueueFinish };
}
