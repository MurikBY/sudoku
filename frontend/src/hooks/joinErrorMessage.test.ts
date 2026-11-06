import { describe, expect, it } from "vitest";

import { joinErrorMessage } from "@/hooks/joinErrorMessage";
import { apiErrorFromStatus } from "@/lib/api/apiError";

describe("joinErrorMessage", () => {
  it("names a full party and a party that is no longer waiting", () => {
    expect(joinErrorMessage(apiErrorFromStatus(409, "party_full", "party is full: party-id"))).toBe(
      "This party is full",
    );
    expect(
      joinErrorMessage(
        apiErrorFromStatus(409, "party_not_waiting", "party has already started: party-id"),
      ),
    ).toBe("This party has already started");
    expect(
      joinErrorMessage(
        apiErrorFromStatus(409, "party_not_waiting", "party was cancelled: party-id"),
      ),
    ).toBe("This party was cancelled");
  });

  it("keeps an unknown conflict and a play lock on their existing messages", () => {
    expect(
      joinErrorMessage(apiErrorFromStatus(404, "party_not_found", "party not found: ABCD")),
    ).toBe("Invalid invite code");
    expect(
      joinErrorMessage(
        apiErrorFromStatus(409, "play_locked", "Another device is playing on this account."),
      ),
    ).toBe("");
    expect(joinErrorMessage(apiErrorFromStatus(409, "party_not_waiting", "something else"))).toBe(
      "Invalid invite code",
    );
  });
});
