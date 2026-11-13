import { useCallback, useEffect, useRef, type Dispatch } from "react";

import { abandonGame } from "@/api/games";
import type { Difficulty, Game, GameReview, StatsPeriod } from "@/api/types";
import type { PartyLobbyPhase } from "@/hooks/partyLobbyState";
import type { PlaySession } from "@/hooks/playSessionTypes";
import type { ScreenAction, ScreenState } from "@/hooks/screenState";
import { useAnalysisSession } from "@/hooks/useAnalysisSession";
import { useHomeGames } from "@/hooks/useHomeGames";
import { useLessonSession } from "@/hooks/useLessonSession";
import { usePartyLobby } from "@/hooks/usePartyLobby";
import { usePlayLockGate } from "@/hooks/usePlayLockGate";
import { usePlayPresence } from "@/hooks/usePlayPresence";
import { usePlaySessionHome } from "@/hooks/usePlaySessionHome";
import { usePlaySessionLobby } from "@/hooks/usePlaySessionLobby";
import { useTelegramDeepLink } from "@/hooks/useTelegramDeepLink";
import { bestEffort } from "@/lib/api/bestEffort";
import type { GameAssists } from "@/lib/play/gameSettings";

function lockConflictAction(
  screenName: ScreenState["name"],
  lobbyOpen: boolean,
  phase: PartyLobbyPhase,
): "goHome" | "leave" | "close" | "stay" {
  if (screenName === "play") {
    return "goHome";
  }
  if (!lobbyOpen) {
    return "stay";
  }
  if (phase === "host" || phase === "guest") {
    return "leave";
  }
  if (phase === "chooser") {
    return "close";
  }
  return "stay";
}

type UsePlaySessionArgs = {
  screen: ScreenState;
  dispatch: Dispatch<ScreenAction>;
  difficulty: Difficulty;
  assists: GameAssists;
  setDifficulty: (difficulty: Difficulty) => void;
  loadStats: (period?: StatsPeriod) => void;
};

export function usePlaySession({
  screen,
  dispatch,
  difficulty,
  assists,
  setDifficulty,
  loadStats,
}: UsePlaySessionArgs): PlaySession {
  const activeGameRef = useRef<Game | null>(null);

  useEffect(() => {
    activeGameRef.current = screen.name === "play" ? screen.game : null;
  }, [screen]);

  const homeGames = useHomeGames();
  const { refreshResumable, setError: setHomeError } = homeGames;

  const {
    playLockedByOther,
    acquirePlayLock,
    releasePlayLock,
    ensurePlayLock,
    playLockIsHeld,
    refreshForeignPlayLock,
    reportLockConflict,
    setLockConflictHandler,
  } = usePlayLockGate({ onError: setHomeError });

  const openPartyResults = useCallback(
    (partyId: string) => {
      void releasePlayLock();
      dispatch({ type: "openPartyResults", partyId });
      void loadStats();
    },
    [dispatch, loadStats, releasePlayLock],
  );

  const leavePlayTo = useCallback(
    (nextScreen: "home" | "rating") => {
      const game = activeGameRef.current;
      void (async () => {
        if (
          game !== null &&
          (game.is_analysis || game.is_lesson) &&
          game.status === "in_progress"
        ) {
          await bestEffort("abandon when leaving analysis or a lesson", () =>
            abandonGame(game.id, game.elapsed_seconds),
          );
        }
        await releasePlayLock();
        dispatch({ type: "leave", to: nextScreen });
        void refreshResumable();
      })();
    },
    [dispatch, refreshResumable, releasePlayLock],
  );

  const goHome = useCallback(() => {
    leavePlayTo("home");
  }, [leavePlayTo]);

  const handlePartyStarted = useCallback(
    ({ game, assists: partyAssists }: { game: Game; assists: GameAssists }) => {
      dispatch({ type: "startPlay", game, assists: partyAssists });
      void loadStats();
      void refreshResumable();
    },
    [dispatch, loadStats, refreshResumable],
  );

  const partyLobby = usePartyLobby({
    difficulty,
    assists,
    onDifficultyChange: setDifficulty,
    onStarted: handlePartyStarted,
  });

  const { lobby, handleCloseLobby, handleLeaveLobby, handlePlayWithFriends } = usePlaySessionLobby({
    partyLobby,
    screenName: screen.name,
    releasePlayLock,
    playLockIsHeld,
  });

  const lobbyOpen = partyLobby.open;
  const lobbyPhase = partyLobby.phase;

  useEffect(() => {
    setLockConflictHandler(() => {
      const action = lockConflictAction(screen.name, lobbyOpen, lobbyPhase);
      if (action === "stay") {
        return null;
      }
      if (action === "goHome") {
        return goHome;
      }
      if (action === "leave") {
        return () => {
          void handleLeaveLobby();
        };
      }
      return handleCloseLobby;
    });
  }, [
    goHome,
    handleCloseLobby,
    handleLeaveLobby,
    lobbyOpen,
    lobbyPhase,
    screen.name,
    setLockConflictHandler,
  ]);

  usePlayPresence({
    screenName: screen.name,
    lobbyOpen,
    ensurePlayLock,
    refreshForeignPlayLock,
    onLockConflict: reportLockConflict,
  });

  const analysis = useAnalysisSession({
    screen,
    dispatch,
    ensurePlayLock: playLockIsHeld,
    releasePlayLock,
    activeGameRef,
  });

  const lesson = useLessonSession({
    dispatch,
    acquirePlayLock,
    releasePlayLock,
    activeGameRef,
  });

  useTelegramDeepLink({
    dispatch,
    openPartyResults,
    playLockIsHeld,
    openLobbyWithInviteCode: partyLobby.openLobbyWithInviteCode,
    onError: setHomeError,
  });

  const home = usePlaySessionHome({
    homeGames,
    dispatch,
    difficulty,
    assists,
    loadStats,
    playLockedByOther,
    playLockIsHeld,
    releasePlayLock,
    playWithFriends: handlePlayWithFriends,
  });

  const handleOpenReview = useCallback(
    (review: GameReview) => {
      dispatch({ type: "openReview", review });
    },
    [dispatch],
  );

  const handleBackFromReview = useCallback(() => {
    if (screen.name !== "review") {
      dispatch({ type: "backFromReview" });
      return;
    }
    const partyId = screen.review.party_id;
    if (partyId) {
      openPartyResults(partyId);
      return;
    }
    dispatch({ type: "backFromReview" });
  }, [dispatch, openPartyResults, screen]);

  const handleOpenRating = useCallback(() => {
    leavePlayTo("rating");
  }, [leavePlayTo]);

  return {
    home,
    lobby,
    review: {
      back: handleBackFromReview,
      open: handleOpenReview,
      openParty: openPartyResults,
    },
    analysis: {
      playFromHere: (shareCode, eventIndex) => {
        void analysis.handlePlayFromHere(shareCode, eventIndex);
      },
      busy: analysis.playFromHereBusy,
      error: analysis.playFromHereError,
      onSolved: analysis.handleAnalysisComplete,
      backToReview: analysis.handleBackFromAnalysis,
    },
    lesson: {
      start: (technique, variant, excludePositionId) => {
        void lesson.handleStartLesson(technique, variant, excludePositionId);
      },
      back: lesson.handleBackFromLesson,
      busy: lesson.lessonStartBusy,
      error: lesson.lessonStartError,
    },
    leave: {
      home: goHome,
      rating: handleOpenRating,
    },
  };
}
