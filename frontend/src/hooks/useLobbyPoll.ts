import { useEffect } from "react";

import { fetchCurrentParty } from "@/api/parties";
import type { Party, PartyAssists } from "@/api/types";

const LOBBY_POLL_MS = 1500;

type UseLobbyPollArgs = {
  // null stops the poll.
  partyId: string | null;
  isGuest: boolean;
  onSnapshot: (party: Party) => void;
  onStarted: (gameId: string, assists: PartyAssists) => Promise<void>;
  onClosedByHost: () => void;
};

// The poll is the recovery when the socket drops: it still sees a start or a cancelled lobby.
export function useLobbyPoll({
  partyId,
  isGuest,
  onSnapshot,
  onStarted,
  onClosedByHost,
}: UseLobbyPollArgs) {
  useEffect(() => {
    if (partyId === null) {
      return undefined;
    }

    const poll = async () => {
      try {
        const current = await fetchCurrentParty();
        if (current !== null && current.id === partyId) {
          onSnapshot(current);
          if (current.status === "started" && current.my_game_id) {
            await onStarted(current.my_game_id, current.assists);
          }
          return;
        }
        if (isGuest && current === null) {
          onClosedByHost();
        }
      } catch {
        // Keep lobby alive; next tick retries. Do not surface transient poll errors.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, LOBBY_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [isGuest, onClosedByHost, onSnapshot, onStarted, partyId]);
}
