import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

import { fetchPartyResults } from "@/api/parties";
import type { PartyResults } from "@/api/types";
import { formatApiErrorMessage, isRetryableApiError } from "@/lib/api/apiError";
import { partyHasOpenPlayers } from "@/lib/play/partyResultsDisplay";
import { retryUntilOk } from "@/lib/api/retryUntilOk";

const PVP_POLL_MS = 8000;

type UsePartyResultsArgs = {
  initialPartyId: string | null;
  loadAbortRef: RefObject<AbortController | null>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setReconnecting: Dispatch<SetStateAction<boolean>>;
};

export function usePartyResults({
  initialPartyId,
  loadAbortRef,
  setLoading,
  setError,
  setReconnecting,
}: UsePartyResultsArgs) {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(initialPartyId);
  const [results, setResults] = useState<PartyResults | null>(null);

  const loadResults = useCallback(
    async (partyId: string, quiet = false) => {
      if (!quiet) {
        loadAbortRef.current?.abort();
        const abortController = new AbortController();
        loadAbortRef.current = abortController;

        setLoading(true);
        setError(null);
        setReconnecting(false);
        try {
          const payload = await retryUntilOk(() => fetchPartyResults(partyId), {
            signal: abortController.signal,
            shouldRetry: isRetryableApiError,
            onAttemptError: (loadError) => {
              setError(formatApiErrorMessage(loadError));
              setReconnecting(true);
            },
          });
          if (abortController.signal.aborted) {
            return;
          }
          setResults(payload);
          setSelectedPartyId(partyId);
          setError(null);
          setReconnecting(false);
        } catch (loadError) {
          if (abortController.signal.aborted) {
            return;
          }
          if (!isRetryableApiError(loadError)) {
            setError(formatApiErrorMessage(loadError));
            setReconnecting(false);
            setResults(null);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setLoading(false);
          }
        }
        return;
      }

      try {
        const payload = await fetchPartyResults(partyId);
        setResults(payload);
        setSelectedPartyId(partyId);
        setError(null);
        setReconnecting(false);
      } catch (loadError) {
        if (isRetryableApiError(loadError)) {
          setError(formatApiErrorMessage(loadError));
          setReconnecting(true);
          return;
        }
        setError(formatApiErrorMessage(loadError));
      }
    },
    [loadAbortRef, setError, setLoading, setReconnecting],
  );

  useEffect(() => {
    if (!results || !partyHasOpenPlayers(results.players)) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      void loadResults(results.id, true);
    }, PVP_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadResults, results]);

  return { selectedPartyId, results, loadResults };
}
