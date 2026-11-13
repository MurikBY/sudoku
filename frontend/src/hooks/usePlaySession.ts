import { type Dispatch } from "react";

import type { Difficulty, StatsPeriod } from "@/api/types";
import type { PlaySession } from "@/hooks/playSessionTypes";
import type { ScreenAction, ScreenState } from "@/hooks/screenState";
import { useActiveGameRef } from "@/hooks/useActiveGameRef";
import { useAnalysisSession } from "@/hooks/useAnalysisSession";
import { useHomeGames } from "@/hooks/useHomeGames";
import { useLessonSession } from "@/hooks/useLessonSession";
import { useLockConflictRouting } from "@/hooks/useLockConflictRouting";
import { usePlayLockGate } from "@/hooks/usePlayLockGate";
import { usePlayPresence } from "@/hooks/usePlayPresence";
import { usePlaySessionHome } from "@/hooks/usePlaySessionHome";
import { usePlaySessionLobby } from "@/hooks/usePlaySessionLobby";
import { usePlaySessionNavigation } from "@/hooks/usePlaySessionNavigation";
import { useTelegramDeepLink } from "@/hooks/useTelegramDeepLink";
import type { GameAssists } from "@/lib/play/gameSettings";

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
  const activeGameRef = useActiveGameRef(screen);
  const homeGames = useHomeGames();
  const { refreshResumable, setError: setHomeError } = homeGames;
  const lockGate = usePlayLockGate({ onError: setHomeError });
  const { releasePlayLock, playLockIsHeld } = lockGate;
  const navigation = usePlaySessionNavigation({
    screen,
    dispatch,
    activeGameRef,
    releasePlayLock,
    refreshResumable,
    loadStats,
  });

  const party = usePlaySessionLobby({
    difficulty,
    assists,
    onDifficultyChange: setDifficulty,
    onStarted: navigation.startPartyGame,
    screenName: screen.name,
    releasePlayLock,
    playLockIsHeld,
  });
  const { lobby } = party;
  useLockConflictRouting({
    screenName: screen.name,
    lobbyOpen: lobby.open,
    lobbyPhase: lobby.phase,
    goHome: navigation.leave.home,
    leaveLobby: party.handleLeaveLobby,
    closeLobby: party.handleCloseLobby,
    setLockConflictHandler: lockGate.setLockConflictHandler,
  });
  usePlayPresence({
    screenName: screen.name,
    lobbyOpen: lobby.open,
    ensurePlayLock: lockGate.ensurePlayLock,
    refreshForeignPlayLock: lockGate.refreshForeignPlayLock,
    onLockConflict: lockGate.reportLockConflict,
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
    acquirePlayLock: lockGate.acquirePlayLock,
    releasePlayLock,
    activeGameRef,
  });
  useTelegramDeepLink({
    dispatch,
    openPartyResults: navigation.openPartyResults,
    playLockIsHeld,
    openLobbyWithInviteCode: party.openLobbyWithInviteCode,
    onError: setHomeError,
  });
  const home = usePlaySessionHome({
    homeGames,
    dispatch,
    difficulty,
    assists,
    loadStats,
    playLockedByOther: lockGate.playLockedByOther,
    playLockIsHeld,
    releasePlayLock,
    playWithFriends: party.handlePlayWithFriends,
  });

  return { home, lobby, review: navigation.review, analysis, lesson, leave: navigation.leave };
}
