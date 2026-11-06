import { useCallback, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchStats } from "@/api/users";
import type { StatsPeriod } from "@/api/types";
import { queryInFlight, queryLoadError, queryLoadReconnecting } from "@/lib/api/queryLoadStatus";

type UseStatsOptions = {
  autoLoad?: boolean;
};

export function useStats({ autoLoad = true }: UseStatsOptions = {}) {
  const [period, setPeriod] = useState<StatsPeriod>("all");
  const statsQuery = useQuery({
    queryKey: ["stats", period],
    queryFn: () => fetchStats(period),
    enabled: autoLoad,
    placeholderData: keepPreviousData,
  });
  const { refetch } = statsQuery;

  const loadStats = useCallback(
    (nextPeriod?: StatsPeriod) => {
      if (nextPeriod !== undefined && nextPeriod !== period) {
        setPeriod(nextPeriod);
        return;
      }
      void refetch();
    },
    [period, refetch],
  );

  return {
    stats: statsQuery.data ?? null,
    period,
    loading: queryInFlight(statsQuery),
    error: queryLoadError(statsQuery),
    reconnecting: queryLoadReconnecting(statsQuery),
    loadStats,
  };
}
