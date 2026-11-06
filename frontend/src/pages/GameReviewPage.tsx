import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";

import type { GameReview } from "@/api/types";
import { SudokuGrid } from "@/components/SudokuGrid";
import { useReviewReplay } from "@/hooks/useReviewReplay";
import { useReviewShare } from "@/hooks/useReviewShare";
import { formatByNickname } from "@/lib/format/formatByNickname";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";

type GameReviewPageProps = {
  review: GameReview;
  onBack: () => void;
  onOpenParty?: (partyId: string) => void;
  onPlayFromHere: (shareCode: string, eventIndex: number) => void;
  playFromHereBusy?: boolean;
  playFromHereError?: string | null;
};

function formatGameStatus(status: GameReview["status"]): string {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "abandoned") {
    return "Abandoned";
  }
  return "In progress";
}

export function GameReviewPage({
  review,
  onBack,
  onOpenParty,
  onPlayFromHere,
  playFromHereBusy = false,
  playFromHereError = null,
}: GameReviewPageProps) {
  const {
    cursor,
    maxCursor,
    isPlaying,
    currentGrid,
    notes,
    reviewWrongDigitIndices,
    flashedCellIndices,
    scrubDisabled,
    handleStepBack,
    handleStepToStart,
    handleStepForward,
    handleStepToEnd,
    handleTogglePlay,
  } = useReviewReplay(review);
  const {
    copiedKind,
    copyError,
    sendNotice,
    isSendingBoard,
    handleCopyCode,
    handleCopyBoard,
    handleDownloadBoard,
  } = useReviewShare(review, currentGrid, notes);

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

        <div className="gazette-review-meta">
          <div className="gazette-review-meta-row">
            {review.is_party && review.party_id && (
              <>
                <button
                  type="button"
                  className="gazette-review-party-link"
                  onClick={() => {
                    if (!onOpenParty) {
                      throw new Error("onOpenParty required for party review");
                    }
                    if (!review.party_id) {
                      throw new Error("party review missing party_id");
                    }
                    onOpenParty(review.party_id);
                  }}
                >
                  Party
                </button>
                <span className="gazette-review-meta-sep" aria-hidden="true">
                  ·
                </span>
              </>
            )}
            <span className="capitalize">{review.difficulty}</span>
            <span className="gazette-review-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums">{formatElapsedSeconds(review.elapsed_seconds)}</span>
            <span className="gazette-review-meta-sep" aria-hidden="true">
              ·
            </span>
            <span>{formatGameStatus(review.status)}</span>
          </div>
          <div className="gazette-review-meta-row">
            <span>
              mistakes <span className="font-medium tabular-nums">{review.mistakes_count}</span>
            </span>
            <span className="gazette-review-meta-sep" aria-hidden="true">
              ·
            </span>
            <span>
              hints <span className="font-medium tabular-nums">{review.hints_count}</span>
            </span>
            <span className="gazette-review-meta-sep" aria-hidden="true">
              ·
            </span>
            <span>
              pencil <span className="font-medium tabular-nums">{review.pencil_count}</span>
            </span>
          </div>
        </div>

        <div className="gazette-review-copy">
          <button
            type="button"
            className="gazette-review-action-btn"
            onClick={() => void handleCopyCode()}
          >
            <Clipboard className="size-3.5" strokeWidth={2} />
            {copiedKind === "code" ? "Copied!" : `Copy ${review.share_code}`}
          </button>
          <p className="gazette-review-export-line">
            <button
              type="button"
              className="gazette-review-export-link"
              onClick={() => void handleCopyBoard()}
            >
              {copiedKind === "board" ? "Copied" : "Copy"}
            </button>
            {" / "}
            <button
              type="button"
              className="gazette-review-export-link"
              disabled={isSendingBoard}
              onClick={() => void handleDownloadBoard()}
            >
              {copiedKind === "sent" ? "Sent" : isSendingBoard ? "Sending" : "Download"}
            </button>
            {" Board for AI Help"}
          </p>
          {copyError && <p className="gazette-review-action-error">{copyError}</p>}
          {sendNotice && !copyError && <p className="gazette-review-action-notice">{sendNotice}</p>}
        </div>

        <div className="gazette-review-board">
          <SudokuGrid
            puzzle={review.puzzle}
            currentGrid={currentGrid}
            notes={notes}
            selectedIndex={null}
            onSelectCell={() => {}}
            highlightPeers={false}
            highlightSameDigit={false}
            wrongDigitIndices={reviewWrongDigitIndices}
            flashedCellIndices={flashedCellIndices}
          />
        </div>
      </div>

      <footer className="gazette-review-footer">
        {scrubDisabled ? (
          <p className="gazette-review-replay-note">Replay unavailable for older games</p>
        ) : (
          <div className="gazette-review-controls">
            <button
              type="button"
              className="gazette-review-control-btn"
              onClick={handleStepToStart}
              disabled={cursor === 0}
              aria-label="Jump to first move"
            >
              <SkipBack className="size-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="gazette-review-control-btn"
              onClick={handleStepBack}
              disabled={cursor === 0}
              aria-label="Step back"
            >
              <ChevronLeft className="size-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="gazette-review-control-btn gazette-review-control-btn-play"
              onClick={handleTogglePlay}
              disabled={maxCursor === 0}
              aria-label={isPlaying ? "Pause replay" : "Play replay"}
            >
              {isPlaying ? (
                <Pause className="size-5" strokeWidth={2} />
              ) : (
                <Play className="size-5" strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              className="gazette-review-control-btn"
              onClick={handleStepForward}
              disabled={cursor >= maxCursor}
              aria-label="Step forward"
            >
              <ChevronRight className="size-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="gazette-review-control-btn"
              onClick={handleStepToEnd}
              disabled={cursor >= maxCursor}
              aria-label="Jump to last move"
            >
              <SkipForward className="size-5" strokeWidth={2} />
            </button>
          </div>
        )}

        {review.replay_available && maxCursor > 0 && (
          <span className="gazette-review-cursor">
            Step {cursor}/{maxCursor}
          </span>
        )}

        {review.play_from_here_available ? (
          <div className="gazette-review-actions">
            <button
              type="button"
              className="gazette-review-action-btn gazette-review-action-btn-primary"
              disabled={playFromHereBusy}
              onClick={() => onPlayFromHere(review.share_code, cursor)}
            >
              {playFromHereBusy ? "Starting…" : "Play from current move"}
            </button>
            {playFromHereError && (
              <p className="gazette-review-action-error">{playFromHereError}</p>
            )}
          </div>
        ) : (
          <p className="gazette-review-replay-note">
            Play from current move is unavailable
            <br />
            while this game is in Continue
          </p>
        )}
      </footer>
    </div>
  );
}
