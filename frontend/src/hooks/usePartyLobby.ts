import { useCallback, useReducer } from "react";

import type { Difficulty, Party } from "@/api/types";
import {
  initialPartyLobbyState,
  partyLobbyReducer,
  type PartyLobbyPhase,
} from "@/hooks/partyLobbyState";
import { useLobbyPoll } from "@/hooks/useLobbyPoll";
import { usePartyLobbyControls } from "@/hooks/usePartyLobbyControls";
import { usePartyLobbyEntry } from "@/hooks/usePartyLobbyEntry";
import { usePartyLobbySocket } from "@/hooks/usePartyLobbySocket";
import { usePartySocket } from "@/hooks/usePartySocket";
import { usePartyStartHandoff, type PartyStartedPayload } from "@/hooks/usePartyStartHandoff";
import type { GameAssists } from "@/lib/play/gameSettings";

export type { PartyLobbyPhase };

type UsePartyLobbyArgs = {
  difficulty: Difficulty;
  assists: GameAssists;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onStarted: (payload: PartyStartedPayload) => void;
};

export function usePartyLobby({
  difficulty,
  assists,
  onDifficultyChange,
  onStarted,
}: UsePartyLobbyArgs) {
  const [lobby, dispatch] = useReducer(partyLobbyReducer, initialPartyLobbyState);
  const { open, phase, party, joinCode, joinedOk } = lobby;
  const { connect: connectPartySocket, disconnect: disconnectSocket } = usePartySocket();
  const { handleStarted, rearmStart } = usePartyStartHandoff({
    dispatch,
    disconnectSocket,
    onStarted,
  });
  const { connectSocket, markLobbyClosedByHost } = usePartyLobbySocket({
    dispatch,
    connectPartySocket,
    disconnectSocket,
    handleStarted,
    rearmStart,
  });

  const applyPartySnapshot = useCallback((snapshot: Party) => {
    dispatch({ type: "applySnapshot", party: snapshot });
  }, []);

  const waitingInLobby =
    party !== null &&
    party.status === "waiting" &&
    (phase === "host" || (phase === "guest" && joinedOk));
  // The id, not the party object: every snapshot is a new object and would restart the poll.
  const waitingPartyId = waitingInLobby ? party.id : null;

  useLobbyPoll({
    partyId: open ? waitingPartyId : null,
    isGuest: phase === "guest",
    onSnapshot: applyPartySnapshot,
    onStarted: handleStarted,
    onClosedByHost: markLobbyClosedByHost,
  });

  const entry = usePartyLobbyEntry({
    dispatch,
    joinCode,
    difficulty,
    assists,
    connectSocket,
    handleStarted,
  });
  const controls = usePartyLobbyControls({
    dispatch,
    party,
    difficulty,
    onDifficultyChange,
    disconnectSocket,
    handleStarted,
  });

  const closeLobby = useCallback(() => {
    dispatch({ type: "close" });
  }, []);

  const dismissClosedLobby = useCallback(() => {
    dispatch({ type: "dismissClosed" });
  }, []);

  return {
    open,
    phase,
    party,
    members: lobby.members,
    joinCode,
    setJoinCode: (nextCode: string) => dispatch({ type: "setJoinCode", joinCode: nextCode }),
    joinedOk,
    busy: lobby.busy,
    error: lobby.error,
    ...entry,
    ...controls,
    closeLobby,
    dismissClosedLobby,
    clearError: () => dispatch({ type: "clearError" }),
    chooseJoin: () => dispatch({ type: "chooseJoin" }),
  };
}
