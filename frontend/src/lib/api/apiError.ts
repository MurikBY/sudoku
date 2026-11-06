export type ApiErrorKind =
  | "network"
  | "timeout"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "validation"
  | "unavailable"
  | "rate_limited"
  | "server"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly serverMessage: string | null;

  constructor(
    kind: ApiErrorKind,
    status: number | null,
    code: string | null = null,
    serverMessage: string | null = null,
  ) {
    super(kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.serverMessage = serverMessage;
  }
}

export function apiErrorFromStatus(
  status: number,
  code: string | null = null,
  serverMessage: string | null = null,
): ApiError {
  if (status === 401 || status === 403) {
    return new ApiError("unauthorized", status, code, serverMessage);
  }
  if (status === 404) {
    return new ApiError("not_found", status, code, serverMessage);
  }
  if (status === 409) {
    return new ApiError("conflict", status, code, serverMessage);
  }
  if (status === 400 || status === 422) {
    return new ApiError("validation", status, code, serverMessage);
  }
  if (status === 503) {
    return new ApiError("unavailable", status, code, serverMessage);
  }
  if (status === 429) {
    return new ApiError("rate_limited", status, code, serverMessage);
  }
  if (status >= 500) {
    return new ApiError("server", status, code, serverMessage);
  }
  return new ApiError("unknown", status, code, serverMessage);
}

export function isPlayLockedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "play_locked";
}

function messageForApiError(
  kind: ApiErrorKind,
  status: number | null,
  serverMessage: string | null,
): string {
  switch (kind) {
    case "network":
      return "No connection. Retrying…";
    case "timeout":
      return "The server is taking too long. Try again.";
    case "unauthorized":
      if (status === 403) {
        return "That action isn't allowed.";
      }
      return "Your session expired. Reopen the app from Telegram.";
    case "not_found":
      return "That item no longer exists.";
    case "conflict":
      return "That action is no longer possible.";
    case "validation":
      return "That request was rejected.";
    case "unavailable":
      return (
        serverMessage ??
        "No puzzles are ready for this difficulty. Try again in a couple of minutes."
      );
    case "rate_limited":
      return serverMessage ?? "Too many requests. Try again in a minute.";
    case "server":
      return "Server error. Try again later.";
    case "unknown":
      return "Something went wrong.";
  }
}

export function formatApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return messageForApiError(error.kind, error.status, error.serverMessage);
  }
  if (error instanceof TypeError) {
    return messageForApiError("network", null, null);
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return messageForApiError("timeout", null, null);
  }
  return messageForApiError("unknown", null, null);
}

export function isRetryableApiError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.kind === "network" || error.kind === "timeout" || error.kind === "server";
  }
  return (
    error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")
  );
}
