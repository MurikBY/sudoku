import { useEffect, useState } from "react";

import type { GameReview } from "@/api/types";
import { useReplayFlashes } from "@/hooks/useReplayFlashes";
import { replayEventsToState } from "@/lib/play/replayEvents";
import { wrongDigitIndices } from "@/lib/play/sudokuGrid";

const REPLAY_INTERVAL_MS = 500;

export function useReviewReplay(review: GameReview) {
  const maxCursor = review.replay_available ? review.events.length : 0;
  const [cursor, setCursor] = useState(maxCursor);
  const [isPlaying, setIsPlaying] = useState(false);
  const { suppressLastPeerNotes, flashedCellIndices } = useReplayFlashes(review.events, cursor);

  if (isPlaying && cursor >= maxCursor) {
    setIsPlaying(false);
  }

  const { currentGrid, notes } = replayEventsToState(review.puzzle, review.events, cursor, {
    suppressLastPeerNotes,
  });
  const reviewWrongDigitIndices = wrongDigitIndices(currentGrid, review.puzzle, review.solution);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setCursor((current) => (current >= maxCursor ? current : current + 1));
    }, REPLAY_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, maxCursor]);

  const scrubDisabled = !review.replay_available;

  const seek = (nextCursor: (current: number) => number) => {
    if (scrubDisabled) {
      return;
    }
    setIsPlaying(false);
    setCursor(nextCursor);
  };

  const handleTogglePlay = () => {
    if (scrubDisabled) {
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (cursor >= maxCursor) {
      setCursor(0);
    }
    setIsPlaying(true);
  };

  return {
    cursor,
    maxCursor,
    isPlaying,
    currentGrid,
    notes,
    reviewWrongDigitIndices,
    flashedCellIndices,
    scrubDisabled,
    handleStepBack: () => seek((current) => Math.max(0, current - 1)),
    handleStepToStart: () => seek(() => 0),
    handleStepForward: () => seek((current) => Math.min(maxCursor, current + 1)),
    handleStepToEnd: () => seek(() => maxCursor),
    handleTogglePlay,
  };
}
