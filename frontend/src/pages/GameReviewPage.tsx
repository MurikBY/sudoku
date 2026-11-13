import type { GameReview } from "@/api/types";
import {
  PlayFromHere,
  ReplayControls,
  ReviewMeta,
  ReviewShareActions,
} from "@/components/GameReviewSections";
import { SudokuGrid } from "@/components/SudokuGrid";
import { useReviewReplay } from "@/hooks/useReviewReplay";
import { useReviewShare } from "@/hooks/useReviewShare";
import { formatByNickname } from "@/lib/format/formatByNickname";

type GameReviewPageProps = {
  review: GameReview;
  onBack: () => void;
  onOpenParty?: (partyId: string) => void;
  onPlayFromHere: (shareCode: string, eventIndex: number) => void;
  playFromHereBusy?: boolean;
  playFromHereError?: string | null;
};

export function GameReviewPage({
  review,
  onBack,
  onOpenParty,
  onPlayFromHere,
  playFromHereBusy = false,
  playFromHereError = null,
}: GameReviewPageProps) {
  const replay = useReviewReplay(review);
  const share = useReviewShare(review, replay.currentGrid, replay.notes);

  return (
    <div className="gazette-review">
      <header className="gazette-home-masthead gazette-stats-masthead gazette-review-masthead">
        <div className="gazette-review-masthead-row">
          <h1 className="home-masthead gazette-review-title">Game Review</h1>
          <button type="button" onClick={onBack} className="gazette-review-back">
            Back
          </button>
        </div>
        <div className="gazette-home-masthead-rule" />
      </header>

      <div className="gazette-review-body">
        <div className="gazette-review-meta-by">
          <span>{formatByNickname(review.display_name)}</span>
        </div>
        <ReviewMeta review={review} onOpenParty={onOpenParty} />
        <ReviewShareActions shareCode={review.share_code} share={share} />
        <div className="gazette-review-board">
          <SudokuGrid
            puzzle={review.puzzle}
            currentGrid={replay.currentGrid}
            notes={replay.notes}
            selectedIndex={null}
            onSelectCell={() => {}}
            highlightPeers={false}
            highlightSameDigit={false}
            wrongDigitIndices={replay.reviewWrongDigitIndices}
            flashedCellIndices={replay.flashedCellIndices}
          />
        </div>
      </div>

      <footer className="gazette-review-footer">
        {replay.scrubDisabled ? (
          <p className="gazette-review-replay-note">Replay unavailable for older games</p>
        ) : (
          <ReplayControls replay={replay} />
        )}
        {review.replay_available && replay.maxCursor > 0 && (
          <span className="gazette-review-cursor">
            Step {replay.cursor}/{replay.maxCursor}
          </span>
        )}
        <PlayFromHere
          available={review.play_from_here_available}
          busy={playFromHereBusy}
          error={playFromHereError}
          onPlay={() => onPlayFromHere(review.share_code, replay.cursor)}
        />
      </footer>
    </div>
  );
}
