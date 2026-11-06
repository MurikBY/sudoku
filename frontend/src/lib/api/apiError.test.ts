import { describe, expect, it } from "vitest";

import {
  ApiError,
  apiErrorFromStatus,
  formatApiErrorMessage,
  isRetryableApiError,
  type ApiErrorKind,
} from "@/lib/api/apiError";

const kindMessages: Record<ApiErrorKind, string> = {
  network: "No connection. Retrying…",
  timeout: "The server is taking too long. Try again.",
  unauthorized: "Your session expired. Reopen the app from Telegram.",
  not_found: "That item no longer exists.",
  conflict: "That action is no longer possible.",
  validation: "That request was rejected.",
  unavailable: "No puzzles are ready for this difficulty. Try again in a couple of minutes.",
  rate_limited: "Too many requests. Try again in a minute.",
  server: "Server error. Try again later.",
  unknown: "Something went wrong.",
};

describe("formatApiErrorMessage", () => {
  it.each(Object.entries(kindMessages) as [ApiErrorKind, string][])(
    "writes %s as user text",
    (kind, message) => {
      expect(formatApiErrorMessage(new ApiError(kind, null))).toBe(message);
      expect(message).not.toMatch(/ERR_/);
    },
  );

  it("tells a forbidden action apart from an expired session", () => {
    expect(formatApiErrorMessage(new ApiError("unauthorized", 403, "party_forbidden"))).toBe(
      "That action isn't allowed.",
    );
    expect(formatApiErrorMessage(new ApiError("unauthorized", 401, "unauthorized"))).toBe(
      kindMessages.unauthorized,
    );
  });

  it("reads 429 as rate_limited and keeps the server message", () => {
    const error = apiErrorFromStatus(
      429,
      "pool_take_rate_limited",
      "Too many new games in a minute. Try again shortly.",
    );
    expect(error.kind).toBe("rate_limited");
    expect(formatApiErrorMessage(error)).toBe("Too many new games in a minute. Try again shortly.");
    expect(isRetryableApiError(error)).toBe(false);
  });

  it("prefers the server message when the service is unavailable", () => {
    expect(
      formatApiErrorMessage(
        new ApiError(
          "unavailable",
          503,
          "puzzle_pool_empty",
          "No puzzles ready for this difficulty. Try again in a couple of minutes.",
        ),
      ),
    ).toBe("No puzzles ready for this difficulty. Try again in a couple of minutes.");
  });

  it("keeps the fixed conflict sentence when the server sent its own", () => {
    expect(
      formatApiErrorMessage(new ApiError("conflict", 409, "party_full", "party is full: x")),
    ).toBe(kindMessages.conflict);
  });

  it("drops the status code from server and unknown errors", () => {
    expect(formatApiErrorMessage(new ApiError("server", 502))).toBe(kindMessages.server);
    expect(formatApiErrorMessage(new ApiError("unknown", 418))).toBe(kindMessages.unknown);
  });

  it("reads a TypeError as no connection", () => {
    expect(formatApiErrorMessage(new TypeError("Failed to fetch"))).toBe(kindMessages.network);
  });

  it("reads an abort as a timeout", () => {
    expect(formatApiErrorMessage(new DOMException("Aborted", "AbortError"))).toBe(
      kindMessages.timeout,
    );
  });

  it("reads any other failure as unknown", () => {
    expect(formatApiErrorMessage(new Error("boom"))).toBe(kindMessages.unknown);
    expect(formatApiErrorMessage("boom")).toBe(kindMessages.unknown);
  });
});
