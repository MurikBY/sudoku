import type { CompletionRecap, Game } from "@/api/types";
import { CompletionCard } from "@/components/CompletionCard";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import type { GameAssists } from "@/lib/play/gameSettings";
import type { PlayMode } from "@/lib/play/playMode";

type PlayCompletionProps = {
  game: Game;
  assists: GameAssists;
  mode: PlayMode;
  isCompleted: boolean;
  showAnalysisSolved: boolean;
  lessonKeepSolving: boolean;
  onLeaveToHome: () => void;
  onOpenRating: () => void;
  onOpenPartyResults?: (partyId: string) => void;
};

function requireCompletionRecap(recap: CompletionRecap | null): CompletionRecap {
  if (recap === null) {
    throw new Error("completed game missing completion recap");
  }
  return recap;
}

export function PlayCompletion({
  game,
  assists,
  mode,
  isCompleted,
  showAnalysisSolved,
  lessonKeepSolving,
  onLeaveToHome,
  onOpenRating,
  onOpenPartyResults,
}: PlayCompletionProps) {
  return (
    <>
      {isCompleted && mode.kind === "analysis" && showAnalysisSolved && (
        <div className="gazette-play-complete">
          <div className="gazette-play-complete-inner">
            <p className="font-display text-3xl font-bold italic text-primary">Solved!</p>
          </div>
        </div>
      )}

      {isCompleted && mode.kind === "lesson" && lessonKeepSolving && (
        <div className="gazette-play-complete">
          <div className="gazette-play-complete-inner">
            <p className="font-display text-3xl font-bold italic text-primary">Solved!</p>
            <div className="gazette-guide-practice">
              <button
                type="button"
                className="gazette-review-action-btn gazette-review-action-btn-primary"
                onClick={mode.onBackToGuide}
              >
                Back to Learning
              </button>
            </div>
          </div>
        </div>
      )}

      {isCompleted && mode.kind === "solo" && (
        <div className="gazette-play-complete">
          <div className="gazette-play-complete-inner">
            <CompletionCard
              difficulty={game.difficulty}
              formattedElapsed={formatElapsedSeconds(game.elapsed_seconds)}
              mistakesCount={game.mistakes_count}
              hintsCount={game.hints_count}
              pencilCount={game.pencil_count}
              completion={requireCompletionRecap(game.completion ?? null)}
              assists={assists}
              onClose={onLeaveToHome}
              onOpenRating={onOpenRating}
              onPartyResults={
                game.party_id && onOpenPartyResults
                  ? () => {
                      if (!game.party_id) {
                        return;
                      }
                      onOpenPartyResults(game.party_id);
                    }
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </>
  );
}
