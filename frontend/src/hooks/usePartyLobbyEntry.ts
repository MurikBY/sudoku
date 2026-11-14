import { type Dispatch, useCallback } from "react";

import { createParty, fetchCurrentParty, joinParty } from "@/api/parties";
import type { Difficulty, PartyAssists } from "@/api/types";
import { joinErrorMessage } from "@/hooks/joinErrorMessage";
import { partyActionErrorMessage } from "@/hooks/partyActionErrorMessage";
import type { PartyLobbyAction } from "@/hooks/partyLobbyState";
import { reportLobbyError } from "@/hooks/reportLobbyError";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsToPayload } from "@/lib/play/preferencesSync";
import { isTelegramUserHost } from "@/lib/telegram/isTelegramUserHost";

type UsePartyLobbyEntryArgs = {
  dispatch: Dispatch<PartyLobbyAction>;
  joinCode: string;
  difficulty: Difficulty;
  assists: GameAssists;
  connectSocket: (partyId: string) => void;
  handleStarted: (gameId: string, assists: PartyAssists) => Promise<void>;
};

// Getting into a lobby: resume the current party, create one, or join by code.
export function usePartyLobbyEntry({
  dispatch,
  joinCode,
  difficulty,
  assists,
  connectSocket,
  handleStarted,
}: UsePartyLobbyEntryArgs) {
  // Create and Join stay disabled until the server says which lobby the player is in:
  // creating over a lobby that failed to load would cancel it.
  const openLobby = useCallback(() => {
    dispatch({ type: "openChecking" });

    void (async () => {
      try {
        const current = await fetchCurrentParty();
        if (current !== null && current.status === "started" && current.my_game_id) {
          dispatch({ type: "applySnapshot", party: current });
          await handleStarted(current.my_game_id, current.assists);
          return;
        }
        if (current !== null && current.status === "waiting") {
          dispatch({ type: "resumeWaiting", party: current, isHost: isTelegramUserHost(current) });
          connectSocket(current.id);
          return;
        }
      } catch (err) {
        dispatch({ type: "checkFailed" });
        reportLobbyError(dispatch, partyActionErrorMessage(err));
        return;
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
      reportLobbyError(dispatch, partyActionErrorMessage(err));
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
      reportLobbyError(dispatch, joinErrorMessage(err));
    } finally {
      dispatch({ type: "setBusy", busy: false });
    }
  }, [connectSocket, dispatch, joinCode]);

  const openLobbyWithInviteCode = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        throw new Error("invite code required");
      }
      dispatch({ type: "openInvite", code: normalized });
      try {
        const joined = await joinParty(normalized);
        dispatch({ type: "resumeWaiting", party: joined, isHost: isTelegramUserHost(joined) });
        connectSocket(joined.id);
      } catch (err) {
        dispatch({ type: "inviteFailed" });
        reportLobbyError(dispatch, joinErrorMessage(err));
      } finally {
        dispatch({ type: "setBusy", busy: false });
      }
    },
    [connectSocket, dispatch],
  );

  return { openLobby, openLobbyWithInviteCode, handleCreate, handleJoin };
}
