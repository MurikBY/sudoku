import { PlayLessonCards } from "@/components/LessonPlayCards";
import { PartyLobbyProgressPanel } from "@/components/PartyLobbyProgressPanel";
import { PlayBoard } from "@/components/PlayBoard";
import { PlayCompletion } from "@/components/PlayCompletion";
import { PlayErrorNotice } from "@/components/PlayErrorNotice";
import { PlayMasthead } from "@/components/PlayMasthead";
import { usePlayPageState } from "@/hooks/usePlayPageState";
import type { Game } from "@/api/types";
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
  const play = usePlayPageState({ initialGame, assists, isPaused, onResume, onStatsRefresh, mode });
  const { board, session } = play;
  const { phase, game, error } = board;
  const isPartyGame = game.party_id !== null;

  return (
    <div className="gazette-play">
      <PlayMasthead
        mode={mode}
        isPlaying={play.isPlaying}
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
          progress={play.lobbyProgress.progress}
          loading={play.lobbyProgress.loading}
          error={play.lobbyProgress.error}
          onClose={() => session.setLobbyOpen(false)}
        />
      )}
      {error && (
        <PlayErrorNotice
          message={error}
          needsRetry={play.completionNeedsRetry}
          onClearError={play.actions.clearError}
          onRetry={() => {
            void play.actions.finishCompletedGame(game.id, play.getElapsedSeconds());
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
        isCompleted={play.isCompleted}
        showAnalysisSolved={play.showAnalysisSolved}
        lessonKeepSolving={play.lessonCards.keepSolving}
        onLeaveToHome={onLeaveToHome}
        onOpenRating={onOpenRating}
        onOpenPartyResults={onOpenPartyResults}
      />
      {(play.isPlaying || play.lessonCards.showSuccess) && (
        <PlayBoardStage play={play} assists={assists} isPaused={isPaused} mode={mode} />
      )}
    </div>
  );
}

type PlayBoardStageProps = {
  play: ReturnType<typeof usePlayPageState>;
  assists: GameAssists;
  isPaused: boolean;
  mode: PlayMode;
};

function PlayBoardStage({ play, assists, isPaused, mode }: PlayBoardStageProps) {
  const { board, session, lessonCards } = play;
  const technique = board.game.lesson_technique ?? null;
  return (
    <div className="gazette-play-board" onPointerDown={session.handleBoardBackgroundPointerDown}>
      <PlayLessonCards
        mode={mode}
        technique={technique}
        showBrief={lessonCards.showBrief}
        showSuccess={lessonCards.showSuccess}
        onDismissBrief={lessonCards.dismissBrief}
        onKeepSolving={lessonCards.continueSolving}
      />
      <PlayBoard
        game={board.game}
        assists={assists}
        session={session}
        formattedElapsed={play.formattedElapsed}
        isPaused={isPaused}
        isPlaying={play.isPlaying}
        selectedIndex={board.selectedIndex}
        mode={mode}
        lang={loadInfoGuideLang()}
        flashes={play.flashes}
      />
    </div>
  );
}
