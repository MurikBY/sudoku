import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createGame, fetchResumableGame } from "@/api/games";
import type { Difficulty, Game } from "@/api/types";
import { formatApiErrorMessage, isPlayLockedError, isRetryableApiError } from "@/lib/api/apiError";
import { queryInFlight, queryLoadError, queryLoadReconnecting } from "@/lib/api/queryLoadStatus";

const RESUMABLE_GAME_QUERY_KEY = ["resumable-game"] as const;

export function useHomeGames() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dismissedReason, setDismissedReason] = useState<unknown>(undefined);
  const resumableQuery = useQuery({
    queryKey: RESUMABLE_GAME_QUERY_KEY,
    queryFn: () => fetchResumableGame(),
  });
  const { refetch } = resumableQuery;

  const dismissQueryError = useCallback(() => {
    const snapshot = queryClient.getQueryState<Game | null>(RESUMABLE_GAME_QUERY_KEY);
    setDismissedReason(snapshot?.fetchFailureReason ?? snapshot?.error ?? null);
  }, [queryClient]);

  const refreshResumable = useCallback(async () => {
    const result = await refetch();
    if (result.isError) {
      return null;
    }
    return result.data ?? null;
  }, [refetch]);

  const startNewGame = useCallback(
    async (difficulty: Difficulty) => {
      setCreating(true);
      setActionError(null);
      dismissQueryError();
      try {
        const game = await createGame(difficulty);
        queryClient.setQueryData<Game | null>(RESUMABLE_GAME_QUERY_KEY, null);
        return game;
      } catch (createError) {
        if (isPlayLockedError(createError)) {
          return null;
        }
        setActionError(formatApiErrorMessage(createError));
        return null;
      } finally {
        setCreating(false);
      }
    },
    [dismissQueryError, queryClient],
  );

  const reason = resumableQuery.failureReason ?? resumableQuery.error;
  const visibleQueryError =
    reason != null && reason !== dismissedReason ? queryLoadError(resumableQuery) : null;
  const resumableGame =
    resumableQuery.isError &&
    resumableQuery.error != null &&
    !isRetryableApiError(resumableQuery.error)
      ? null
      : (resumableQuery.data ?? null);

  return {
    resumableGame,
    loading: queryInFlight(resumableQuery),
    creating,
    error: actionError ?? visibleQueryError,
    reconnecting:
      actionError === null && visibleQueryError !== null && queryLoadReconnecting(resumableQuery),
    refreshResumable,
    startNewGame,
    setError: setActionError,
    clearError: () => {
      setActionError(null);
      dismissQueryError();
    },
  };
}
