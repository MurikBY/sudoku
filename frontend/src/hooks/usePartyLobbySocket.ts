import { type Dispatch, useCallback } from "react";

import type { PartyAssists, PartyWsEvent } from "@/api/types";
import { partyActionErrorMessage } from "@/hooks/partyActionErrorMessage";
import type { PartyLobbyAction } from "@/hooks/partyLobbyState";
import { reportLobbyError } from "@/hooks/reportLobbyError";
import type { usePartySocket } from "@/hooks/usePartySocket";

type UsePartyLobbySocketArgs = {
  dispatch: Dispatch<PartyLobbyAction>;
  connectPartySocket: ReturnType<typeof usePartySocket>["connect"];
  disconnectSocket: () => void;
  handleStarted: (gameId: string, assists: PartyAssists) => Promise<void>;
  rearmStart: () => void;
};

// Turns lobby socket events into lobby state: members, the start, and a host cancel.
export function usePartyLobbySocket({
  dispatch,
  connectPartySocket,
  disconnectSocket,
  handleStarted,
  rearmStart,
}: UsePartyLobbySocketArgs) {
  const markLobbyClosedByHost = useCallback(() => {
    disconnectSocket();
    dispatch({ type: "closedByHost" });
  }, [disconnectSocket, dispatch]);

  const handlePartyEvent = useCallback(
    (event: PartyWsEvent) => {
      if (event.type === "members") {
        dispatch({
          type: "membersEvent",
          members: event.members,
          status: event.status,
          difficulty: event.difficulty,
        });
        return;
      }
      if (event.type === "started") {
        void handleStarted(event.game_id, event.assists);
        return;
      }
      if (event.type === "cancelled") {
        markLobbyClosedByHost();
      }
    },
    [dispatch, handleStarted, markLobbyClosedByHost],
  );

  const reportConnectError = useCallback(
    (err: unknown) => {
      reportLobbyError(dispatch, partyActionErrorMessage(err));
    },
    [dispatch],
  );

  const connectSocket = useCallback(
    (partyId: string) => {
      rearmStart();
      connectPartySocket(partyId, {
        onEvent: handlePartyEvent,
        onConnectError: reportConnectError,
      });
    },
    [connectPartySocket, handlePartyEvent, rearmStart, reportConnectError],
  );

  return { connectSocket, markLobbyClosedByHost };
}
