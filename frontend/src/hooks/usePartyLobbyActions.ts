import { type Dispatch, useCallback } from "react";

import {
  cancelParty,
  createParty,
  fetchCurrentParty,
  joinParty,
  leaveParty,
  startParty,
  updatePartyDifficulty,
} from "@/api/parties";
import type { Difficulty, Party, PartyAssists } from "@/api/types";
import { joinErrorMessage } from "@/hooks/joinErrorMessage";
import { partyActionErrorMessage } from "@/hooks/partyActionErrorMessage";
import type { PartyLobbyAction } from "@/hooks/partyLobbyState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsToPayload } from "@/lib/play/preferencesSync";

type UsePartyLobbyActionsArgs = {
  dispatch: Dispatch<PartyLobbyAction>;
  party: Party | null;
  joinCode: string;
  difficulty: Difficulty;
  assists: GameAssists;
  onDifficultyChange: (difficulty: Difficulty) => void;
  connectSocket: (partyId: string) => void;
  disconnectSocket: () => void;
  handleStarted: (gameId: string, assists: PartyAssists) => Promise<void>;
};

export function usePartyLobbyActions({
  dispatch,
  party,
  joinCode,
  difficulty,
  assists,
  onDifficultyChange,
  connectSocket,
  disconnectSocket,
  handleStarted,
}: UsePartyLobbyActionsArgs) {
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
  }, [connectSocket, dispatch, handleStarted]);

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
  }, [assists, connectSocket, difficulty, dispatch]);

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
  }, [connectSocket, dispatch, joinCode]);

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
  }, [difficulty, dispatch, handleStarted, party]);

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
    [dispatch, onDifficultyChange, party],
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
  }, [disconnectSocket, dispatch, party]);

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
    [connectSocket, dispatch],
  );

  return {
    openLobby,
    openLobbyWithInviteCode,
    handleCreate,
    handleJoin,
    handleStart,
    handleDifficultyChange,
    handleLeave,
  };
}
