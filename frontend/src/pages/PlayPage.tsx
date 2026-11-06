import { useEffect, useRef, useState } from "react";

import { syncGameProgress } from "@/api/games";
import type { Game } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LessonBriefCard, LessonSuccessCard } from "@/components/LessonPlayCards";
import { PartyLobbyProgressPanel } from "@/components/PartyLobbyProgressPanel";
import { PlayBoard } from "@/components/PlayBoard";
import { PlayCompletion } from "@/components/PlayCompletion";
import { PlayMasthead } from "@/components/PlayMasthead";
import { COMPLETION_CONNECTION_ERROR } from "@/hooks/useBoardMoves";
import { useGame } from "@/hooks/useGame";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useHintFlash } from "@/hooks/useHintFlash";
import { useMistakeFeedback } from "@/hooks/useMistakeFeedback";
import { usePartyProgress } from "@/hooks/usePartyProgress";
import { usePlayBoardSession } from "@/hooks/usePlayBoardSession";
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
  const { clearError, finishCompletedGame } = actions;
  const { animatedMistakeIndex, triggerMistakeFeedback } = useMistakeFeedback();
  const [lessonKeepSolving, setLessonKeepSolving] = useState(false);
  const [lessonBriefOpen, setLessonBriefOpen] = useState(mode.kind === "lesson");
  const isPlaying = phase === "playing" && game.status === "in_progress";
  const isCompleted = phase === "completed";
  const showAnalysisSolved = isCompleted && mode.kind === "analysis";
  const onAnalysisSolved = mode.kind === "analysis" ? mode.onSolved : undefined;
  const isPartyGame = game.party_id !== null;
  const showLessonSuccess =
    mode.kind === "lesson" &&
    game.lesson_objective_met === true &&
    !lessonKeepSolving &&
    (isPlaying || isCompleted);
  const showLessonBrief =
    mode.kind === "lesson" && isPlaying && !showLessonSuccess && lessonBriefOpen;
  const { formattedElapsed, getElapsedSeconds, setElapsedFromServer } = useGameTimer({
    gameId: game.id,
    initialElapsedSeconds: game.elapsed_seconds,
    isRunning: isPlaying && !isPaused,
  });
  const wasPausedRef = useRef(isPaused);
  const session = usePlayBoardSession({
    board,
    pending,
    actions,
    assists,
    play: { isPlaying, showLessonSuccess, isPaused, onResume, mode },
    timer: { getElapsedSeconds, setElapsedFromServer },
    triggerMistakeFeedback,
  });
  const {
    progress: lobbyProgress,
    error: lobbyProgressError,
    loading: lobbyProgressLoading,
  } = usePartyProgress(game.party_id ?? null, session.lobbyOpen);
  const celebratingIndices = useUnitCompletionCelebration({
    gameId: assists.unitCompleteAnimation ? game.id : null,
    grid: game.current_grid,
    conflictIndices,
    wrongDigitIndices,
  });

  useEffect(() => {
    const becamePaused = isPaused && !wasPausedRef.current;
    wasPausedRef.current = isPaused;
    if (!becamePaused || game.status !== "in_progress") {
      return;
    }
    void syncGameProgress(game.id, getElapsedSeconds()).catch(() => {
      // best-effort flush when pausing
    });
  }, [isPaused, game.id, game.status, getElapsedSeconds]);

  useEffect(() => {
    return () => {
      if (game.status !== "in_progress") {
        return;
      }
      void syncGameProgress(game.id, getElapsedSeconds()).catch(() => {
        // best-effort flush when leaving Play
      });
    };
  }, [game.id, game.status, getElapsedSeconds]);

  useEffect(() => {
    if (!showAnalysisSolved || onAnalysisSolved === undefined) {
      return;
    }
    const timerId = window.setTimeout(() => {
      onAnalysisSolved();
    }, 1500);
    return () => window.clearTimeout(timerId);
  }, [onAnalysisSolved, showAnalysisSolved]);

  if (mode.kind === "lesson" && game.lesson_objective_met === null) {
    throw new Error("lesson game missing lesson_objective_met");
  }
  if (mode.kind === "lesson" && game.lesson_has_practice === null) {
    throw new Error("lesson game missing lesson_has_practice");
  }

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
          progress={lobbyProgress}
          loading={lobbyProgressLoading}
          error={lobbyProgressError}
          onClose={() => session.setLobbyOpen(false)}
        />
      )}
      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner
            message={error}
            onAutoClear={completionNeedsRetry ? undefined : clearError}
          />
          {completionNeedsRetry ? (
            <button
              type="button"
              className="mt-2 border border-destructive/40 bg-transparent px-3 py-2 font-mono text-sm tracking-wide text-destructive"
              onClick={() => {
                void finishCompletedGame(game.id, getElapsedSeconds());
              }}
            >
              Try again
            </button>
          ) : null}
        </div>
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
        lessonKeepSolving={lessonKeepSolving}
        onLeaveToHome={onLeaveToHome}
        onOpenRating={onOpenRating}
        onOpenPartyResults={onOpenPartyResults}
      />
      {(isPlaying || showLessonSuccess) && (
        <div
          className="gazette-play-board"
          onPointerDown={session.handleBoardBackgroundPointerDown}
        >
          {showLessonBrief && (
            <LessonBriefCard
              technique={game.lesson_technique ?? null}
              onDismiss={() => setLessonBriefOpen(false)}
            />
          )}
          {mode.kind === "lesson" && showLessonSuccess && (
            <LessonSuccessCard
              technique={game.lesson_technique ?? null}
              practiceBusy={mode.practiceBusy}
              practiceError={mode.practiceError}
              onKeepSolving={() => setLessonKeepSolving(true)}
              onTryAnotherPuzzle={mode.onTryAnotherPuzzle}
              onBackToGuide={mode.onBackToGuide}
            />
          )}
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
