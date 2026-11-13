import { formatApiErrorMessage, isPlayLockedError } from "@/lib/api/apiError";

// A play-lock conflict already leaves the lobby screen, so it gets no message here.
export function partyActionErrorMessage(error: unknown): string {
  if (isPlayLockedError(error)) {
    return "";
  }
  return formatApiErrorMessage(error);
}
