import { useState } from "react";

import type { PlayMode } from "@/lib/play/playMode";

// The party progress panel exists only for a solo-mode party game, so it closes otherwise.
export function useLobbyPanelOpen(isPartyGame: boolean, mode: PlayMode) {
  const [lobbyOpen, setLobbyOpen] = useState(false);
  if (lobbyOpen && (!isPartyGame || mode.kind !== "solo")) {
    setLobbyOpen(false);
  }
  return { lobbyOpen, setLobbyOpen };
}
