import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchPartyProgress } from "@/api/parties";
import { queryLoadError } from "@/lib/api/queryLoadStatus";

const PROGRESS_POLL_MS = 3500;

export function usePartyProgress(partyId: string | null, enabled: boolean) {
  const active = enabled && partyId !== null;
  const progressQuery = useQuery({
    queryKey: ["party-progress", partyId],
    queryFn: () => {
      if (partyId === null) {
        throw new Error("party progress requires a party id");
      }
      return fetchPartyProgress(partyId);
    },
    enabled: active,
    retry: false,
    refetchInterval: active ? PROGRESS_POLL_MS : false,
  });
  const liveError = active ? queryLoadError(progressQuery) : null;
  const [heldError, setHeldError] = useState<string | null>(null);
  if (!active && heldError !== null) {
    setHeldError(null);
  }
  if (active && liveError !== null && liveError !== heldError) {
    setHeldError(liveError);
  }
  const pollSettled =
    !progressQuery.isFetching && !progressQuery.isPaused && progressQuery.isSuccess;
  if (active && heldError !== null && liveError === null && pollSettled) {
    setHeldError(null);
  }

  const error = liveError ?? (active ? heldError : null);
  return {
    progress: active ? (progressQuery.data ?? null) : null,
    error,
    loading: active && progressQuery.isLoading && error === null,
  };
}
