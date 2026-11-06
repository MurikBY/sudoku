import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchGameHistory, fetchGameReviewByCode } from "@/api/games";
import type { Difficulty, GameHistoryItem, GameReview, GameStatus } from "@/api/types";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { queryInFlight, queryLoadError, queryLoadReconnecting } from "@/lib/api/queryLoadStatus";

export const GAMES_PAGE_SIZE = 10;

export type GamesDifficultyFilter = "all" | Difficulty;
export type GamesStatusFilter = "all" | GameStatus;

type UsePvpHistoryArgs = {
  enabled: boolean;
  onOpenReview: (review: GameReview) => void;
};

export function usePvpHistory({ enabled, onOpenReview }: UsePvpHistoryArgs) {
  const [historyPage, setHistoryPage] = useState(0);
  const [difficultyFilter, setDifficultyFilter] = useState<GamesDifficultyFilter>("all");
  const [statusFilter, setStatusFilter] = useState<GamesStatusFilter>("all");
  const [findCode, setFindCode] = useState("");
  const [findBusy, setFindBusy] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const historyQuery = useQuery({
    queryKey: ["game-history", historyPage, difficultyFilter, statusFilter],
    queryFn: () =>
      fetchGameHistory(GAMES_PAGE_SIZE, historyPage * GAMES_PAGE_SIZE, {
        ...(difficultyFilter === "all" ? {} : { difficulty: difficultyFilter }),
        ...(statusFilter === "all" ? {} : { status: statusFilter }),
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  if (historyQuery.data !== undefined) {
    const lastPage = Math.max(0, Math.ceil(historyQuery.data.total / GAMES_PAGE_SIZE) - 1);
    if (historyPage > lastPage) {
      setHistoryPage(lastPage);
    }
  }

  const handleFindGame = async () => {
    const trimmed = findCode.trim();
    if (!trimmed || findBusy) {
      return;
    }
    setFindBusy(true);
    setFindError(null);
    try {
      const review = await fetchGameReviewByCode(trimmed);
      onOpenReview(review);
    } catch (loadError) {
      setFindError(formatApiErrorMessage(loadError));
    } finally {
      setFindBusy(false);
    }
  };

  function changeDifficultyFilter(value: GamesDifficultyFilter) {
    setDifficultyFilter(value);
    setHistoryPage(0);
  }

  function changeStatusFilter(value: GamesStatusFilter) {
    setStatusFilter(value);
    setHistoryPage(0);
  }

  const history: GameHistoryItem[] | null =
    historyQuery.data === undefined ? null : historyQuery.data.items;

  return {
    history,
    historyTotal: historyQuery.data?.total ?? 0,
    historyPage,
    setHistoryPage,
    difficultyFilter,
    statusFilter,
    findCode,
    setFindCode,
    findBusy,
    findError,
    handleFindGame,
    changeDifficultyFilter,
    changeStatusFilter,
    loading: queryInFlight(historyQuery),
    error: queryLoadError(historyQuery),
    reconnecting: queryLoadReconnecting(historyQuery),
  };
}
