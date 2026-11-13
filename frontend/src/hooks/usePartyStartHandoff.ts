import { type Dispatch, useCallback, useEffect, useRef } from "react";

import { fetchGame } from "@/api/games";
import type { Game, PartyAssists } from "@/api/types";
import type { PartyLobbyAction } from "@/hooks/partyLobbyState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsFromPayload } from "@/lib/play/preferencesSync";

export type PartyStartedPayload = {
  game: Game;
  assists: GameAssists;
};

type UsePartyStartHandoffArgs = {
  dispatch: Dispatch<PartyLobbyAction>;
  disconnectSocket: () => void;
  onStarted: (payload: PartyStartedPayload) => void;
};

// The socket, the poll, and the start response can all report the start; the first one wins
// until the next socket connect rearms it.
export function usePartyStartHandoff({
  dispatch,
  disconnectSocket,
  onStarted,
}: UsePartyStartHandoffArgs) {
  const startedHandledRef = useRef(false);
  const onStartedRef = useRef(onStarted);

  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

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
    [disconnectSocket, dispatch],
  );

  const rearmStart = useCallback(() => {
    startedHandledRef.current = false;
  }, []);

  return { handleStarted, rearmStart };
}
