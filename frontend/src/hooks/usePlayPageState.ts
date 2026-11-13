import type { Game } from "@/api/types";
import { COMPLETION_CONNECTION_ERROR } from "@/hooks/useBoardMoves";
import { useAnalysisSolvedExit } from "@/hooks/useAnalysisSolvedExit";
import { useGame } from "@/hooks/useGame";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useHintFlash } from "@/hooks/useHintFlash";
import { useLessonCards } from "@/hooks/useLessonCards";
import { useMistakeFeedback } from "@/hooks/useMistakeFeedback";
import { usePartyProgress } from "@/hooks/usePartyProgress";
import { usePlayBoardSession } from "@/hooks/usePlayBoardSession";
import { usePlayProgressFlush } from "@/hooks/usePlayProgressFlush";
import { useUnitCompletionCelebration } from "@/hooks/useUnitCompletionCelebration";
import { shouldAutoComplete } from "@/lib/play/boardNotes";
import type { GameAssists } from "@/lib/play/gameSettings";
import type { PlayMode } from "@/lib/play/playMode";

type UsePlayPageStateArgs = {
  initialGame: Game;
  assists: GameAssists;
  isPaused: boolean;
  onResume: () => void;
  onStatsRefresh?: () => void;
  mode: PlayMode;
};

export function usePlayPageState({
  initialGame,
  assists,
  isPaused,
  onResume,
  onStatsRefresh,
  mode,
}: UsePlayPageStateArgs) {
  const { hintedCellIndex, flashedCellIndices, triggerHintFlash } = useHintFlash();
  const { board, pending, actions } = useGame({
    initialGame,
    onGameStateChanged: onStatsRefresh,
    onCellsFlash: triggerHintFlash,
  });
  const { phase, game, conflictIndices, wrongDigitIndices } = board;
  const { animatedMistakeIndex, triggerMistakeFeedback } = useMistakeFeedback();
  const isPlaying = phase === "playing" && game.status === "in_progress";
  const isCompleted = phase === "completed";
  const showAnalysisSolved = isCompleted && mode.kind === "analysis";
  const lessonCards = useLessonCards({ mode, game, isPlaying, isCompleted });
  const timer = useGameTimer({
    gameId: game.id,
    initialElapsedSeconds: game.elapsed_seconds,
    isRunning: isPlaying && !isPaused,
  });
  const { getElapsedSeconds, setElapsedFromServer } = timer;
  const session = usePlayBoardSession({
    board,
    pending,
    actions,
    assists,
    play: { isPlaying, showLessonSuccess: lessonCards.showSuccess, isPaused, onResume, mode },
    timer: { getElapsedSeconds, setElapsedFromServer },
    triggerMistakeFeedback,
  });
  const lobbyProgress = usePartyProgress(game.party_id ?? null, session.lobbyOpen);
  const celebratingIndices = useUnitCompletionCelebration({
    gameId: assists.unitCompleteAnimation ? game.id : null,
    grid: game.current_grid,
    conflictIndices,
    wrongDigitIndices,
  });
  usePlayProgressFlush({ gameId: game.id, gameStatus: game.status, isPaused, getElapsedSeconds });
  useAnalysisSolvedExit(showAnalysisSolved, mode.kind === "analysis" ? mode.onSolved : undefined);

  return {
    board,
    actions,
    session,
    lessonCards,
    lobbyProgress,
    formattedElapsed: timer.formattedElapsed,
    getElapsedSeconds,
    isPlaying,
    isCompleted,
    showAnalysisSolved,
    completionNeedsRetry: board.error === COMPLETION_CONNECTION_ERROR && shouldAutoComplete(game),
    flashes: { animatedMistakeIndex, hintedCellIndex, flashedCellIndices, celebratingIndices },
  };
}
