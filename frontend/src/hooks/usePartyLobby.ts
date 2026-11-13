import { useCallback, useEffect, useReducer, useRef } from "react";

import { fetchGame } from "@/api/games";
import {
  cancelParty,
  createParty,
  fetchCurrentParty,
  joinParty,
  leaveParty,
  partyWebSocketUrl,
  startParty,
  updatePartyDifficulty,
} from "@/api/parties";
import type { Difficulty, Game, Party, PartyAssists, PartyWsEvent } from "@/api/types";
import { joinErrorMessage } from "@/hooks/joinErrorMessage";
import {
  initialPartyLobbyState,
  partyLobbyReducer,
  type PartyLobbyPhase,
} from "@/hooks/partyLobbyState";
import { formatApiErrorMessage, isPlayLockedError } from "@/lib/api/apiError";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsFromPayload, assistsToPayload } from "@/lib/play/preferencesSync";

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

const LOBBY_POLL_MS = 1500;

function partyActionErrorMessage(error: unknown): string {
  if (isPlayLockedError(error)) {
    return "";
  }
  return formatApiErrorMessage(error);
}

export function usePartyLobby({
  difficulty,
  assists,
  onDifficultyChange,
  onStarted,
}: UsePartyLobbyArgs) {
  const [lobby, dispatch] = useReducer(partyLobbyReducer, initialPartyLobbyState);
  const { open, phase, party, members, joinCode, joinedOk, busy, error } = lobby;
  const socketRef = useRef<WebSocket | null>(null);
  // disconnectSocket bumps this so a ticket that arrives after leave cannot open a socket.
  const partySocketAttemptRef = useRef(0);
  const startedHandledRef = useRef(false);
  const onStartedRef = useRef(onStarted);

  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

  const disconnectSocket = useCallback(() => {
    partySocketAttemptRef.current += 1;
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket !== null) {
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
    }
  }, []);

  const applyPartySnapshot = useCallback((snapshot: Party) => {
    dispatch({ type: "applySnapshot", party: snapshot });
  }, []);

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

  const connectSocket = useCallback(
    (partyId: string) => {
      disconnectSocket();
      const attempt = partySocketAttemptRef.current;
      startedHandledRef.current = false;
      void (async () => {
        let url: string;
        try {
          url = await partyWebSocketUrl(partyId);
        } catch (err) {
          if (partySocketAttemptRef.current !== attempt) {
            return;
          }
          const message = partyActionErrorMessage(err);
          if (message) {
            dispatch({ type: "setError", error: message });
          }
          return;
        }
        if (partySocketAttemptRef.current !== attempt) {
          return;
        }
        let socket: WebSocket;
        try {
          socket = new WebSocket(url);
        } catch {
          return;
        }
        if (partySocketAttemptRef.current !== attempt) {
          socket.close();
          return;
        }
        socketRef.current = socket;
        socket.onmessage = (message) => {
          const event = JSON.parse(String(message.data)) as PartyWsEvent;
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
        };
        socket.onclose = () => {
          if (socketRef.current === socket) {
            socketRef.current = null;
          }
        };
      })();
    },
    [disconnectSocket, handleStarted, markLobbyClosedByHost],
  );

  useEffect(() => () => disconnectSocket(), [disconnectSocket]);

  const waitingInLobby =
    party !== null &&
    party.status === "waiting" &&
    (phase === "host" || (phase === "guest" && joinedOk));
  // The id, not the party object: every snapshot is a new object and would restart the poll.
  const waitingPartyId = waitingInLobby ? party.id : null;
  const isGuest = phase === "guest";

  useEffect(() => {
    if (!open || waitingPartyId === null) {
      return undefined;
    }
    const partyId = waitingPartyId;

    const poll = async () => {
      try {
        const current = await fetchCurrentParty();
        if (current !== null && current.id === partyId) {
          applyPartySnapshot(current);
          if (current.status === "started" && current.my_game_id) {
            await handleStarted(current.my_game_id, current.assists);
          }
          return;
        }
        if (isGuest && current === null) {
          markLobbyClosedByHost();
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
  }, [applyPartySnapshot, handleStarted, isGuest, markLobbyClosedByHost, open, waitingPartyId]);

  const openLobby = useCallback(() => {
    dispatch({ type: "openChooser" });

    void (async () => {
      try {
        const current = await fetchCurrentParty();
        if (current !== null && current.status === "started" && current.my_game_id) {
          dispatch({ type: "applySnapshot", party: current });
          await handleStarted(current.my_game_id, current.assists);
          return;
        }
        if (current !== null && current.status === "waiting") {
          const isHost = current.host_user_id === window.Telegram.WebApp.initDataUnsafe.user?.id;
          dispatch({ type: "resumeWaiting", party: current, isHost });
          connectSocket(current.id);
          return;
        }
      } catch {
        // Fall through to chooser.
      }
      dispatch({ type: "showChooser" });
    })();
  }, [connectSocket, handleStarted]);

  const closeLobby = useCallback(() => {
    dispatch({ type: "close" });
  }, []);

  const dismissClosedLobby = useCallback(() => {
    dispatch({ type: "dismissClosed" });
  }, []);

  const handleCreate = useCallback(async () => {
    dispatch({ type: "setBusy", busy: true });
    dispatch({ type: "clearError" });
    try {
      const created = await createParty(difficulty, assistsToPayload(assists));
      dispatch({ type: "createSucceeded", party: created });
      connectSocket(created.id);
    } catch (err) {
      const message = partyActionErrorMessage(err);
      if (message) {
        dispatch({ type: "setError", error: message });
      }
    } finally {
      dispatch({ type: "setBusy", busy: false });
    }
  }, [assists, connectSocket, difficulty]);

  const handleJoin = useCallback(async () => {
    dispatch({ type: "setBusy", busy: true });
    dispatch({ type: "clearError" });
    try {
      const joined = await joinParty(joinCode.trim());
      dispatch({ type: "joinSucceeded", party: joined });
      connectSocket(joined.id);
    } catch (err) {
      dispatch({ type: "joinFailed" });
      const message = joinErrorMessage(err);
      if (message) {
        dispatch({ type: "setError", error: message });
      }
    } finally {
      dispatch({ type: "setBusy", busy: false });
    }
  }, [connectSocket, joinCode]);

  const handleStart = useCallback(async () => {
    if (party === null) {
      return;
    }
    dispatch({ type: "setBusy", busy: true });
    dispatch({ type: "clearError" });
    try {
      const started = await startParty(party.id, difficulty);
      dispatch({ type: "applySnapshot", party: started.party });
      await handleStarted(started.game_id, started.party.assists);
    } catch (err) {
      const message = partyActionErrorMessage(err);
      if (message) {
        dispatch({ type: "setError", error: message });
      }
      dispatch({ type: "setBusy", busy: false });
    }
  }, [difficulty, handleStarted, party]);

  const handleDifficultyChange = useCallback(
    async (level: Difficulty) => {
      if (party === null) {
        throw new Error("party required to change lobby difficulty");
      }
      dispatch({ type: "clearError" });
      try {
        const updated = await updatePartyDifficulty(party.id, level);
        dispatch({ type: "applySnapshot", party: updated });
        onDifficultyChange(level);
      } catch (err) {
        const message = partyActionErrorMessage(err);
        if (message) {
          dispatch({ type: "setError", error: message });
        }
      }
    },
    [onDifficultyChange, party],
  );

  const handleLeave = useCallback(async () => {
    if (party === null) {
      dispatch({ type: "leaveReset" });
      return;
    }
    dispatch({ type: "setBusy", busy: true });
    dispatch({ type: "clearError" });
    try {
      if (party.host_user_id === window.Telegram.WebApp.initDataUnsafe.user?.id) {
        await cancelParty(party.id);
      } else {
        await leaveParty(party.id);
      }
      disconnectSocket();
      dispatch({ type: "leaveReset" });
    } catch (err) {
      dispatch({ type: "setError", error: formatApiErrorMessage(err) });
    } finally {
      dispatch({ type: "setBusy", busy: false });
    }
  }, [disconnectSocket, party]);

  const openLobbyWithInviteCode = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        throw new Error("invite code required");
      }
      dispatch({ type: "openInvite", code: normalized });
      try {
        const joined = await joinParty(normalized);
        const selfId = window.Telegram.WebApp.initDataUnsafe.user?.id;
        const isHost = selfId !== undefined && joined.host_user_id === selfId;
        dispatch({ type: "resumeWaiting", party: joined, isHost });
        connectSocket(joined.id);
      } catch (err) {
        dispatch({ type: "inviteFailed" });
        const message = joinErrorMessage(err);
        if (message) {
          dispatch({ type: "setError", error: message });
        }
      } finally {
        dispatch({ type: "setBusy", busy: false });
      }
    },
    [connectSocket],
  );

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
    openLobby,
    openLobbyWithInviteCode,
    closeLobby,
    dismissClosedLobby,
    handleCreate,
    handleJoin,
    handleStart,
    handleDifficultyChange,
    handleLeave,
    clearError: () => dispatch({ type: "clearError" }),
    chooseJoin: () => dispatch({ type: "chooseJoin" }),
  };
}
