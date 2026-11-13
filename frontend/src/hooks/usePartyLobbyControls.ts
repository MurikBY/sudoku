import { type Dispatch, useCallback } from "react";

import { cancelParty, leaveParty, startParty, updatePartyDifficulty } from "@/api/parties";
import type { Difficulty, Party, PartyAssists } from "@/api/types";
import { partyActionErrorMessage } from "@/hooks/partyActionErrorMessage";
import type { PartyLobbyAction } from "@/hooks/partyLobbyState";
import { reportLobbyError } from "@/hooks/reportLobbyError";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { isTelegramUserHost } from "@/lib/telegram/isTelegramUserHost";

type UsePartyLobbyControlsArgs = {
  dispatch: Dispatch<PartyLobbyAction>;
  party: Party | null;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  disconnectSocket: () => void;
  handleStarted: (gameId: string, assists: PartyAssists) => Promise<void>;
};

// Inside a lobby: the host starts or changes difficulty, and anyone leaves.
export function usePartyLobbyControls({
  dispatch,
  party,
  difficulty,
  onDifficultyChange,
  disconnectSocket,
  handleStarted,
}: UsePartyLobbyControlsArgs) {
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
      reportLobbyError(dispatch, partyActionErrorMessage(err));
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
        reportLobbyError(dispatch, partyActionErrorMessage(err));
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
      if (isTelegramUserHost(party)) {
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

  return { handleStart, handleDifficultyChange, handleLeave };
}
