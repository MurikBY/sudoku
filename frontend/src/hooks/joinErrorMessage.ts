import { ApiError, formatApiErrorMessage, isPlayLockedError } from "@/lib/api/apiError";

export function joinErrorMessage(error: unknown): string {
  if (isPlayLockedError(error)) {
    return "";
  }
  if (error instanceof ApiError && error.kind === "conflict" && error.serverMessage !== null) {
    if (error.serverMessage.startsWith("party is full")) {
      return "This party is full";
    }
    if (error.serverMessage.startsWith("party has already started")) {
      return "This party has already started";
    }
    if (error.serverMessage.startsWith("party was cancelled")) {
      return "This party was cancelled";
    }
  }
  if (error instanceof ApiError && (error.kind === "not_found" || error.kind === "conflict")) {
    return "Invalid invite code";
  }
  return formatApiErrorMessage(error);
}
