import { useCallback, useEffect, useReducer, useRef } from "react";

import { fetchGame } from "@/api/games";
import type { Difficulty, Game, Party, PartyAssists, PartyWsEvent } from "@/api/types";
import { partyActionErrorMessage } from "@/hooks/partyActionErrorMessage";
import {
  initialPartyLobbyState,
  partyLobbyReducer,
  type PartyLobbyPhase,
} from "@/hooks/partyLobbyState";
import { useLobbyPoll } from "@/hooks/useLobbyPoll";
import { usePartyLobbyActions } from "@/hooks/usePartyLobbyActions";
import { usePartySocket } from "@/hooks/usePartySocket";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsFromPayload } from "@/lib/play/preferencesSync";

export type { PartyLobbyPhase };

type PartyStartedPayload = {
  game: Game;
  assists: GameAssists;
};

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
  const { open, phase, party, members, joinCode, joinedOk, busy, error } = lobby;
  const { connect: connectPartySocket, disconnect: disconnectSocket } = usePartySocket();
  const startedHandledRef = useRef(false);
  const onStartedRef = useRef(onStarted);

  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

  const applyPartySnapshot = useCallback((snapshot: Party) => {
    dispatch({ type: "applySnapshot", party: snapshot });
  }, []);

  // The socket, the poll, and the start response can all report the start; the first one wins.
  const handleStarted = useCallback(
    async (gameId: string, partyAssists: PartyAssists) => {
      if (startedHandledRef.current) {
        return;
      }
      startedHandledRef.current = true;
      dispatch({ type: "setBusy", busy: true });
      dispatch({ type: "clearError" });
      try {
        const game = await fetchGame(gameId);
        disconnectSocket();
        dispatch({ type: "close" });
        onStartedRef.current({
          game,
          assists: assistsFromPayload(partyAssists),
        });
      } catch (err) {
        startedHandledRef.current = false;
        dispatch({ type: "setError", error: formatApiErrorMessage(err) });
      } finally {
        dispatch({ type: "setBusy", busy: false });
      }
    },
    [disconnectSocket],
  );

  const markLobbyClosedByHost = useCallback(() => {
    disconnectSocket();
    dispatch({ type: "closedByHost" });
  }, [disconnectSocket]);

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
    [handleStarted, markLobbyClosedByHost],
  );

  const reportTicketError = useCallback((err: unknown) => {
    const message = partyActionErrorMessage(err);
    if (message) {
      dispatch({ type: "setError", error: message });
    }
  }, []);

  const connectSocket = useCallback(
    (partyId: string) => {
      startedHandledRef.current = false;
      connectPartySocket(partyId, { onEvent: handlePartyEvent, onTicketError: reportTicketError });
    },
    [connectPartySocket, handlePartyEvent, reportTicketError],
  );

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

  const actions = usePartyLobbyActions({
    dispatch,
    party,
    joinCode,
    difficulty,
    assists,
    onDifficultyChange,
    connectSocket,
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
    members,
    joinCode,
    setJoinCode: (nextCode: string) => dispatch({ type: "setJoinCode", joinCode: nextCode }),
    joinedOk,
    busy,
    error,
    ...actions,
    closeLobby,
    dismissClosedLobby,
    clearError: () => dispatch({ type: "clearError" }),
    chooseJoin: () => dispatch({ type: "chooseJoin" }),
  };
}
