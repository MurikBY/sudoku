import {
  useCallback,
  useEffect,
  useRef,
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

type LoadStatusSetters = {
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setReconnecting: Dispatch<SetStateAction<boolean>>;
};

type ResultsSink = LoadStatusSetters & {
  showResults: (partyId: string, payload: PartyResults) => void;
  clearResults: () => void;
};

// A visible load retries until it succeeds or a newer load aborts it.
async function loadWithRetry(partyId: string, signal: AbortSignal, sink: ResultsSink) {
  sink.setLoading(true);
  sink.setError(null);
  sink.setReconnecting(false);
  try {
    const payload = await retryUntilOk(() => fetchPartyResults(partyId), {
      signal,
      shouldRetry: isRetryableApiError,
      onAttemptError: (loadError) => {
        sink.setError(formatApiErrorMessage(loadError));
        sink.setReconnecting(true);
      },
    });
    if (signal.aborted) {
      return;
    }
    sink.showResults(partyId, payload);
  } catch (loadError) {
    if (signal.aborted) {
      return;
    }
    if (!isRetryableApiError(loadError)) {
      sink.setError(formatApiErrorMessage(loadError));
      sink.setReconnecting(false);
      sink.clearResults();
    }
  } finally {
    if (!signal.aborted) {
      sink.setLoading(false);
    }
  }
}

// A poll keeps the results on screen and only reports the error.
async function refreshQuietly(partyId: string, sink: ResultsSink) {
  try {
    sink.showResults(partyId, await fetchPartyResults(partyId));
  } catch (loadError) {
    sink.setError(formatApiErrorMessage(loadError));
    if (isRetryableApiError(loadError)) {
      sink.setReconnecting(true);
    }
  }
}

function abortPartyLoad(controllerRef: RefObject<AbortController | null>) {
  controllerRef.current?.abort();
}

type UsePartyResultsArgs = LoadStatusSetters & {
  initialPartyId: string | null;
};

export function usePartyResults({
  initialPartyId,
  setLoading,
  setError,
  setReconnecting,
}: UsePartyResultsArgs) {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(initialPartyId);
  const [results, setResults] = useState<PartyResults | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);

  const loadResults = useCallback(
    async (partyId: string, quiet = false) => {
      const sink: ResultsSink = {
        setLoading,
        setError,
        setReconnecting,
        showResults: (loadedPartyId, payload) => {
          setResults(payload);
          setSelectedPartyId(loadedPartyId);
          setError(null);
          setReconnecting(false);
        },
        clearResults: () => setResults(null),
      };
      if (quiet) {
        await refreshQuietly(partyId, sink);
        return;
      }
      abortPartyLoad(loadAbortRef);
      const abortController = new AbortController();
      loadAbortRef.current = abortController;
      await loadWithRetry(partyId, abortController.signal, sink);
    },
    [setError, setLoading, setReconnecting],
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

  useEffect(() => {
    if (initialPartyId !== null) {
      void loadResults(initialPartyId);
    }
    return () => {
      abortPartyLoad(loadAbortRef);
    };
  }, [initialPartyId, loadResults]);

  return { selectedPartyId, results, loadResults };
}
