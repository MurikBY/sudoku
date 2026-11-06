import { isRetryableApiError } from "@/lib/api/apiError";

const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 10_000;

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      window.clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export type RetryUntilOkOptions = {
  signal?: AbortSignal;
  shouldRetry?: (error: unknown) => boolean;
  onAttemptError?: (error: unknown, attempt: number) => void;
  initialDelayMs?: number;
  maxDelayMs?: number;
};

export async function retryUntilOk<T>(
  operation: () => Promise<T>,
  options: RetryUntilOkOptions = {},
): Promise<T> {
  const signal = options.signal ?? new AbortController().signal;
  const shouldRetry = options.shouldRetry ?? isRetryableApiError;
  const initialDelayMs = options.initialDelayMs ?? INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? MAX_DELAY_MS;

  let attempt = 0;
  let delayMs = initialDelayMs;

  while (true) {
    if (signal.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (!shouldRetry(error) || signal.aborted) {
        throw error;
      }
      options.onAttemptError?.(error, attempt);
      await delay(delayMs, signal);
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }
}
