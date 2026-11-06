import { formatApiErrorMessage, isRetryableApiError } from "@/lib/api/apiError";

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10_000;

type QueryLoadSnapshot = {
  isFetching: boolean;
  isPaused: boolean;
  failureCount: number;
  failureReason: unknown;
  error: unknown;
};

export function retryQueryFailure(_failureCount: number, error: unknown): boolean {
  return isRetryableApiError(error);
}

export function queryRetryDelayMs(failureCount: number): number {
  return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** failureCount, MAX_RETRY_DELAY_MS);
}

export function queryLoadError(
  query: Pick<QueryLoadSnapshot, "failureReason" | "error">,
): string | null {
  const reason = query.failureReason ?? query.error;
  if (reason == null) {
    return null;
  }
  return formatApiErrorMessage(reason);
}

export function queryLoadReconnecting(query: QueryLoadSnapshot): boolean {
  const reason = query.failureReason ?? query.error;
  if (query.failureCount === 0 || reason == null || !isRetryableApiError(reason)) {
    return false;
  }
  return query.isFetching || query.isPaused;
}

export function queryInFlight(query: Pick<QueryLoadSnapshot, "isFetching" | "isPaused">): boolean {
  return query.isFetching || query.isPaused;
}
