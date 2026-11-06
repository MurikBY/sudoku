import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";

import { abandonGame, fetchGameReviewByCode } from "@/api/games";
import { fetchPlayLockStatus } from "@/api/playLock";
import type { Difficulty, Game, GameReview, Party, PartyMember, StatsPeriod } from "@/api/types";
import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";
import { useAnalysisSession } from "@/hooks/useAnalysisSession";
import { useHomeGames } from "@/hooks/useHomeGames";
import { useLessonSession } from "@/hooks/useLessonSession";
import { usePartyLobby, type PartyLobbyPhase } from "@/hooks/usePartyLobby";
import { usePlayLock, type PlayLockAttempt } from "@/hooks/usePlayLock";
import { usePlayPresence } from "@/hooks/usePlayPresence";
import type { ScreenAction, ScreenState } from "@/hooks/screenState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { bestEffort } from "@/lib/api/bestEffort";
import type { GameAssists } from "@/lib/play/gameSettings";
import { assistsFromPayload } from "@/lib/play/preferencesSync";
import { readTelegramDeepLink } from "@/lib/telegram/readTelegramDeepLink";

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

export type PlaySessionHome = {
  playLocked: boolean;
  loading: boolean;
  creating: boolean;
  error: string | null;
  reconnecting: boolean;
  hasResumableGame: boolean;
  clearError: () => void;
  startNew: () => void;
  continueGame: () => void;
  playWithFriends: () => void;
  refreshResumable: () => Promise<Game | null>;
};

export type PlaySessionLobby = {
  open: boolean;
  phase: PartyLobbyPhase;
  party: Party | null;
  members: PartyMember[];
  joinCode: string;
  joinedOk: boolean;
  busy: boolean;
  error: string | null;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onJoinCodeChange: (value: string) => void;
  onChooseJoin: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onStart: () => void;
  onLeave: () => void;
  onClose: () => void;
  onDismissClosed: () => void;
  onClearError: () => void;
};

type PlaySessionReview = {
  back: () => void;
  open: (review: GameReview) => void;
  openParty: (partyId: string) => void;
};

type PlaySessionAnalysis = {
  playFromHere: (shareCode: string, eventIndex: number) => void;
  busy: boolean;
  error: string | null;
  onSolved: () => void;
  backToReview: () => void;
};

type PlaySessionLesson = {
  start: (
    technique: TechniqueArticleId,
    variant: "taught" | "practice",
    excludePositionId?: string,
  ) => void;
  back: () => void;
  busy: boolean;
  error: string | null;
};

type PlaySessionLeave = {
  home: () => void;
  rating: () => void;
};

type PlaySession = {
  home: PlaySessionHome;
  lobby: PlaySessionLobby;
  review: PlaySessionReview;
  analysis: PlaySessionAnalysis;
  lesson: PlaySessionLesson;
  leave: PlaySessionLeave;
};

export function usePlaySession({
  screen,
  dispatch,
  difficulty,
  assists,
  setDifficulty,
  loadStats,
}: UsePlaySessionArgs): PlaySession {
  const partyDeepLinkHandled = useRef(false);
  const onLockConflictRef = useRef<() => void>(() => {});
  // Stays set until the next acquire, so a second watcher does not call leaveParty again.
  const lockConflictHandledRef = useRef(false);
  const activeGameRef = useRef<Game | null>(null);
  const [playLockedByOther, setPlayLockedByOther] = useState(false);

  useEffect(() => {
    activeGameRef.current = screen.name === "play" ? screen.game : null;
  }, [screen]);

  const {
    resumableGame,
    loading: homeLoading,
    creating,
    error: homeError,
    reconnecting: homeReconnecting,
    refreshResumable,
    startNewGame,
    setError: setHomeError,
    clearError: clearHomeError,
  } = useHomeGames();

  const reportLockConflict = useCallback(() => {
    onLockConflictRef.current();
  }, []);

  const { acquire: acquirePlayLockRaw, release: releasePlayLock } = usePlayLock({
    onLostLock: reportLockConflict,
  });

  const acquirePlayLock = useCallback(async () => {
    const acquired = await acquirePlayLockRaw();
    if (acquired) {
      lockConflictHandledRef.current = false;
    }
    return acquired;
  }, [acquirePlayLockRaw]);

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

  const ensurePlayLock = useCallback(async (): Promise<PlayLockAttempt> => {
    try {
      const acquired = await acquirePlayLock();
      if (!acquired) {
        setPlayLockedByOther(true);
        return "conflict";
      }
      setPlayLockedByOther(false);
      return "acquired";
    } catch (error) {
      setHomeError(formatApiErrorMessage(error));
      return "failed";
    }
  }, [acquirePlayLock, setHomeError]);

  const playLockIsHeld = useCallback(async () => {
    return (await ensurePlayLock()) === "acquired";
  }, [ensurePlayLock]);

  const refreshForeignPlayLock = useCallback(async () => {
    await bestEffort("keep last known lock UI; click path still enforces", async () => {
      const status = await fetchPlayLockStatus();
      setPlayLockedByOther(status.locked && !status.is_holder);
    });
  }, []);

  const handleCloseLobby = useCallback(() => {
    partyLobby.closeLobby();
    if (screen.name !== "play") {
      void releasePlayLock();
    }
  }, [partyLobby, releasePlayLock, screen.name]);

  const handleLeaveLobby = useCallback(async () => {
    await partyLobby.handleLeave();
    if (screen.name !== "play") {
      void releasePlayLock();
    }
  }, [partyLobby, releasePlayLock, screen.name]);

  const handleLockConflict = useCallback(() => {
    if (lockConflictHandledRef.current) {
      return;
    }
    const action = lockConflictAction(screen.name, partyLobby.open, partyLobby.phase);
    if (action === "stay") {
      return;
    }
    lockConflictHandledRef.current = true;
    if (action === "goHome") {
      goHome();
      return;
    }
    if (action === "leave") {
      void handleLeaveLobby();
      return;
    }
    handleCloseLobby();
  }, [goHome, handleCloseLobby, handleLeaveLobby, partyLobby.open, partyLobby.phase, screen.name]);

  useEffect(() => {
    onLockConflictRef.current = handleLockConflict;
  }, [handleLockConflict]);

  usePlayPresence({
    screenName: screen.name,
    lobbyOpen: partyLobby.open,
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

  const { openLobbyWithInviteCode } = partyLobby;

  useEffect(() => {
    if (partyDeepLinkHandled.current) {
      return;
    }
    const deepLink = readTelegramDeepLink();
    if (!deepLink) {
      return;
    }
    partyDeepLinkHandled.current = true;
    if (deepLink.kind === "party") {
      openPartyResults(deepLink.partyId);
      return;
    }
    if (deepLink.kind === "lobby") {
      void (async () => {
        if (!(await playLockIsHeld())) {
          return;
        }
        await openLobbyWithInviteCode(deepLink.code);
      })();
      return;
    }
    void fetchGameReviewByCode(deepLink.code)
      .then((review) => {
        dispatch({ type: "openReview", review });
      })
      .catch((error) => {
        setHomeError(formatApiErrorMessage(error));
      });
  }, [dispatch, openLobbyWithInviteCode, openPartyResults, playLockIsHeld, setHomeError]);

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

  const handlePlayWithFriends = useCallback(async () => {
    if (!(await playLockIsHeld())) {
      return;
    }
    partyLobby.openLobby();
  }, [partyLobby, playLockIsHeld]);

  const handleDismissClosedLobby = useCallback(() => {
    partyLobby.dismissClosedLobby();
    void releasePlayLock();
  }, [partyLobby, releasePlayLock]);

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
    home: {
      playLocked: playLockedByOther,
      loading: homeLoading,
      creating,
      error: homeError,
      reconnecting: homeReconnecting,
      hasResumableGame: resumableGame !== null,
      clearError: clearHomeError,
      startNew: () => {
        void handleStartNew();
      },
      continueGame: () => {
        void handleContinue();
      },
      playWithFriends: () => {
        void handlePlayWithFriends();
      },
      refreshResumable,
    },
    lobby: {
      open: partyLobby.open,
      phase: partyLobby.phase,
      party: partyLobby.party,
      members: partyLobby.members,
      joinCode: partyLobby.joinCode,
      joinedOk: partyLobby.joinedOk,
      busy: partyLobby.busy,
      error: partyLobby.error,
      onDifficultyChange: (level) => {
        void partyLobby.handleDifficultyChange(level);
      },
      onJoinCodeChange: partyLobby.setJoinCode,
      onChooseJoin: partyLobby.chooseJoin,
      onCreate: () => {
        void partyLobby.handleCreate();
      },
      onJoin: () => {
        void partyLobby.handleJoin();
      },
      onStart: () => {
        void partyLobby.handleStart();
      },
      onLeave: () => {
        void handleLeaveLobby();
      },
      onClose: handleCloseLobby,
      onDismissClosed: handleDismissClosedLobby,
      onClearError: partyLobby.clearError,
    },
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
