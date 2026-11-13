import type { Dispatch } from "react";

import type { PartyLobbyAction } from "@/hooks/partyLobbyState";

// An empty message is an error that already moved the user elsewhere, such as a play-lock conflict.
export function reportLobbyError(dispatch: Dispatch<PartyLobbyAction>, message: string) {
  if (message) {
    dispatch({ type: "setError", error: message });
  }
}
