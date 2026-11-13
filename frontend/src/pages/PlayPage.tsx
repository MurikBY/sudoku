import type { Game } from "@/api/types";
import { PlayLessonCards } from "@/components/LessonPlayCards";
import { PartyLobbyProgressPanel } from "@/components/PartyLobbyProgressPanel";
import { PlayBoard } from "@/components/PlayBoard";
import { PlayCompletion } from "@/components/PlayCompletion";
import { PlayErrorNotice } from "@/components/PlayErrorNotice";
import { PlayMasthead } from "@/components/PlayMasthead";
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
import { loadInfoGuideLang } from "@/content/infoGuideCopy";

type PlayPageProps = {
  initialGame: Game;
  assists: GameAssists;
  isPaused: boolean;
  onResume: () => void;
  onTogglePause: () => void;
  onLeaveToHome: () => void;
  onStatsRefresh?: () => void;
  onOpenRating: () => void;
  onOpenPartyResults?: (partyId: string) => void;
  mode: PlayMode;
};

export function PlayPage({
  initialGame,
  assists,
  isPaused,
  onResume,
  onTogglePause,
  onLeaveToHome,
  onStatsRefresh,
  onOpenRating,
  onOpenPartyResults,
  mode,
}: PlayPageProps) {
  const lang = loadInfoGuideLang();
  const { hintedCellIndex, flashedCellIndices, triggerHintFlash } = useHintFlash();
  const { board, pending, actions } = useGame({
    initialGame,
    onGameStateChanged: onStatsRefresh,
    onCellsFlash: triggerHintFlash,
  });
  const { phase, game, error, selectedIndex, conflictIndices, wrongDigitIndices } = board;
  const { animatedMistakeIndex, triggerMistakeFeedback } = useMistakeFeedback();
  const isPlaying = phase === "playing" && game.status === "in_progress";
  const isCompleted = phase === "completed";
  const showAnalysisSolved = isCompleted && mode.kind === "analysis";
  const isPartyGame = game.party_id !== null;
  const lessonCards = useLessonCards({ mode, game, isPlaying, isCompleted });
  const { formattedElapsed, getElapsedSeconds, setElapsedFromServer } = useGameTimer({
    gameId: game.id,
    initialElapsedSeconds: game.elapsed_seconds,
    isRunning: isPlaying && !isPaused,
  });
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

  const completionNeedsRetry = error === COMPLETION_CONNECTION_ERROR && shouldAutoComplete(game);

  return (
    <div className="gazette-play">
      <PlayMasthead
        mode={mode}
        isPlaying={isPlaying}
        isPartyGame={isPartyGame}
        difficulty={game.difficulty}
        lobbyOpen={session.lobbyOpen}
        isPaused={isPaused}
        lessonTechnique={game.lesson_technique ?? null}
        onToggleLobby={() => session.setLobbyOpen((current) => !current)}
        onTogglePause={onTogglePause}
        onLeaveToHome={onLeaveToHome}
      />
      {isPartyGame && (
        <PartyLobbyProgressPanel
          open={session.lobbyOpen}
          progress={lobbyProgress.progress}
          loading={lobbyProgress.loading}
          error={lobbyProgress.error}
          onClose={() => session.setLobbyOpen(false)}
        />
      )}
      {error && (
        <PlayErrorNotice
          message={error}
          needsRetry={completionNeedsRetry}
          onClearError={actions.clearError}
          onRetry={() => {
            void actions.finishCompletedGame(game.id, getElapsedSeconds());
          }}
        />
      )}
      {phase === "completing" && (
        <p className="flex flex-1 items-center justify-center font-display text-lg italic text-muted-foreground">
          Checking solution…
        </p>
      )}
      <PlayCompletion
        game={game}
        assists={assists}
        mode={mode}
        isCompleted={isCompleted}
        showAnalysisSolved={showAnalysisSolved}
        lessonKeepSolving={lessonCards.keepSolving}
        onLeaveToHome={onLeaveToHome}
        onOpenRating={onOpenRating}
        onOpenPartyResults={onOpenPartyResults}
      />
      {(isPlaying || lessonCards.showSuccess) && (
        <div
          className="gazette-play-board"
          onPointerDown={session.handleBoardBackgroundPointerDown}
        >
          <PlayLessonCards
            mode={mode}
            technique={game.lesson_technique ?? null}
            showBrief={lessonCards.showBrief}
            showSuccess={lessonCards.showSuccess}
            onDismissBrief={lessonCards.dismissBrief}
            onKeepSolving={lessonCards.continueSolving}
          />
          <PlayBoard
            game={game}
            assists={assists}
            session={session}
            formattedElapsed={formattedElapsed}
            isPaused={isPaused}
            isPlaying={isPlaying}
            selectedIndex={selectedIndex}
            mode={mode}
            lang={lang}
            animatedMistakeIndex={animatedMistakeIndex}
            hintedCellIndex={hintedCellIndex}
            flashedCellIndices={flashedCellIndices}
            celebratingIndices={celebratingIndices}
          />
        </div>
      )}
    </div>
  );
}
