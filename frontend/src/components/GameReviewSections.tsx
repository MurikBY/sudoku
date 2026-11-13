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
import type { useReviewReplay } from "@/hooks/useReviewReplay";
import type { useReviewShare } from "@/hooks/useReviewShare";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";

type ReviewReplay = ReturnType<typeof useReviewReplay>;
type ReviewShare = ReturnType<typeof useReviewShare>;

function formatGameStatus(status: GameReview["status"]): string {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "abandoned") {
    return "Abandoned";
  }
  return "In progress";
}

function MetaSeparator() {
  return (
    <span className="gazette-review-meta-sep" aria-hidden="true">
      ·
    </span>
  );
}

type ReviewMetaProps = {
  review: GameReview;
  onOpenParty?: (partyId: string) => void;
};

export function ReviewMeta({ review, onOpenParty }: ReviewMetaProps) {
  return (
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
            <MetaSeparator />
          </>
        )}
        <span className="capitalize">{review.difficulty}</span>
        <MetaSeparator />
        <span className="tabular-nums">{formatElapsedSeconds(review.elapsed_seconds)}</span>
        <MetaSeparator />
        <span>{formatGameStatus(review.status)}</span>
      </div>
      <div className="gazette-review-meta-row">
        <span>
          mistakes <span className="font-medium tabular-nums">{review.mistakes_count}</span>
        </span>
        <MetaSeparator />
        <span>
          hints <span className="font-medium tabular-nums">{review.hints_count}</span>
        </span>
        <MetaSeparator />
        <span>
          pencil <span className="font-medium tabular-nums">{review.pencil_count}</span>
        </span>
      </div>
    </div>
  );
}

export function ReviewShareActions({
  shareCode,
  share,
}: {
  shareCode: string;
  share: ReviewShare;
}) {
  const { copiedKind, copyError, sendNotice, isSendingBoard } = share;
  return (
    <div className="gazette-review-copy">
      <button
        type="button"
        className="gazette-review-action-btn"
        onClick={() => void share.handleCopyCode()}
      >
        <Clipboard className="size-3.5" strokeWidth={2} />
        {copiedKind === "code" ? "Copied!" : `Copy ${shareCode}`}
      </button>
      <p className="gazette-review-export-line">
        <button
          type="button"
          className="gazette-review-export-link"
          onClick={() => void share.handleCopyBoard()}
        >
          {copiedKind === "board" ? "Copied" : "Copy"}
        </button>
        {" / "}
        <button
          type="button"
          className="gazette-review-export-link"
          disabled={isSendingBoard}
          onClick={() => void share.handleDownloadBoard()}
        >
          {copiedKind === "sent" ? "Sent" : isSendingBoard ? "Sending" : "Download"}
        </button>
        {" Board for AI Help"}
      </p>
      {copyError && <p className="gazette-review-action-error">{copyError}</p>}
      {sendNotice && !copyError && <p className="gazette-review-action-notice">{sendNotice}</p>}
    </div>
  );
}

export function ReplayControls({ replay }: { replay: ReviewReplay }) {
  const { cursor, maxCursor, isPlaying } = replay;
  return (
    <div className="gazette-review-controls">
      <button
        type="button"
        className="gazette-review-control-btn"
        onClick={replay.handleStepToStart}
        disabled={cursor === 0}
        aria-label="Jump to first move"
      >
        <SkipBack className="size-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        className="gazette-review-control-btn"
        onClick={replay.handleStepBack}
        disabled={cursor === 0}
        aria-label="Step back"
      >
        <ChevronLeft className="size-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        className="gazette-review-control-btn gazette-review-control-btn-play"
        onClick={replay.handleTogglePlay}
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
        onClick={replay.handleStepForward}
        disabled={cursor >= maxCursor}
        aria-label="Step forward"
      >
        <ChevronRight className="size-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        className="gazette-review-control-btn"
        onClick={replay.handleStepToEnd}
        disabled={cursor >= maxCursor}
        aria-label="Jump to last move"
      >
        <SkipForward className="size-5" strokeWidth={2} />
      </button>
    </div>
  );
}

type PlayFromHereProps = {
  available: boolean;
  busy: boolean;
  error: string | null;
  onPlay: () => void;
};

export function PlayFromHere({ available, busy, error, onPlay }: PlayFromHereProps) {
  if (!available) {
    return (
      <p className="gazette-review-replay-note">
        Play from current move is unavailable
        <br />
        while this game is in Continue
      </p>
    );
  }
  return (
    <div className="gazette-review-actions">
      <button
        type="button"
        className="gazette-review-action-btn gazette-review-action-btn-primary"
        disabled={busy}
        onClick={onPlay}
      >
        {busy ? "Starting…" : "Play from current move"}
      </button>
      {error && <p className="gazette-review-action-error">{error}</p>}
    </div>
  );
}
