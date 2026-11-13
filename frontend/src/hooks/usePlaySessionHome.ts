import { useCallback, type Dispatch } from "react";

import type { Difficulty, StatsPeriod } from "@/api/types";
import type { PlaySessionHome } from "@/hooks/playSessionTypes";
import type { ScreenAction } from "@/hooks/screenState";
import type { useHomeGames } from "@/hooks/useHomeGames";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsFromPayload } from "@/lib/play/preferencesSync";

type UsePlaySessionHomeArgs = {
  homeGames: ReturnType<typeof useHomeGames>;
  dispatch: Dispatch<ScreenAction>;
  difficulty: Difficulty;
  assists: GameAssists;
  loadStats: (period?: StatsPeriod) => void;
  playLockedByOther: boolean;
  playLockIsHeld: () => Promise<boolean>;
  releasePlayLock: () => Promise<void>;
  playWithFriends: () => Promise<void>;
};

export function usePlaySessionHome({
  homeGames,
  dispatch,
  difficulty,
  assists,
  loadStats,
  playLockedByOther,
  playLockIsHeld,
  releasePlayLock,
  playWithFriends,
}: UsePlaySessionHomeArgs): PlaySessionHome {
  const { resumableGame, startNewGame } = homeGames;

  const handleStartNew = useCallback(async () => {
    if (!(await playLockIsHeld())) {
      return;
    }
    const started = await startNewGame(difficulty);
    if (!started) {
      await releasePlayLock();
      return;
    }
    dispatch({ type: "startPlay", game: started, assists: { ...assists } });
    void loadStats();
  }, [assists, difficulty, dispatch, loadStats, playLockIsHeld, releasePlayLock, startNewGame]);

  const handleContinue = useCallback(async () => {
    if (!resumableGame) {
      return;
    }
    if (!(await playLockIsHeld())) {
      return;
    }
    dispatch({
      type: "startPlay",
      game: resumableGame,
      assists: assistsFromPayload(resumableGame.assists),
    });
  }, [dispatch, playLockIsHeld, resumableGame]);

  return {
    playLocked: playLockedByOther,
    loading: homeGames.loading,
    creating: homeGames.creating,
    error: homeGames.error,
    reconnecting: homeGames.reconnecting,
    hasResumableGame: resumableGame !== null,
    clearError: homeGames.clearError,
    startNew: () => {
      void handleStartNew();
    },
    continueGame: () => {
      void handleContinue();
    },
    playWithFriends: () => {
      void playWithFriends();
    },
    refreshResumable: homeGames.refreshResumable,
  };
}
