import { useEffect, useState } from "react";

import type { GameEvent, GameReview } from "@/api/types";
import { MOVE_PEER_NOTES_DELAY_MS, useHintFlash } from "@/hooks/useHintFlash";
import { peerNoteCellIndices, replayEventsToState } from "@/lib/play/replayEvents";
import { wrongDigitIndices } from "@/lib/play/sudokuGrid";

const REPLAY_INTERVAL_MS = 500;

type ReplayStepFlash = {
  eventCell: number;
  peerCells: number[];
};

function replayStepFlash(
  events: GameEvent[],
  previousCursor: number,
  cursor: number,
): ReplayStepFlash | null {
  if (cursor !== previousCursor + 1) {
    return null;
  }
  const event = events[cursor - 1];
  if (event === undefined) {
    return null;
  }
  const eventCell = event.cell;
  if (eventCell == null || eventCell < 0 || eventCell > 80) {
    return null;
  }
  const peerCells = peerNoteCellIndices(event.peer_notes);
  const suppressPeerNotes = (event.kind === "set" || event.kind === "hint") && peerCells.length > 0;
  return { eventCell, peerCells: suppressPeerNotes ? peerCells : [] };
}

export function useReviewReplay(review: GameReview) {
  const maxCursor = review.replay_available ? review.events.length : 0;
  const [cursor, setCursor] = useState(maxCursor);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trackedCursor, setTrackedCursor] = useState(0);
  const [stepFlash, setStepFlash] = useState<ReplayStepFlash | null>(null);
  const [suppressLastPeerNotes, setSuppressLastPeerNotes] = useState(false);
  const { flashedCellIndices, triggerHintFlash } = useHintFlash();

  if (isPlaying && cursor >= maxCursor) {
    setIsPlaying(false);
  }

  if (cursor !== trackedCursor) {
    const flash = replayStepFlash(review.events, trackedCursor, cursor);
    setTrackedCursor(cursor);
    setSuppressLastPeerNotes(flash !== null && flash.peerCells.length > 0);
    setStepFlash(flash);
  }

  const { currentGrid, notes } = replayEventsToState(review.puzzle, review.events, cursor, {
    suppressLastPeerNotes,
  });
  const reviewWrongDigitIndices = wrongDigitIndices(currentGrid, review.puzzle, review.solution);

  useEffect(() => {
    if (stepFlash === null) {
      return;
    }
    triggerHintFlash(stepFlash.eventCell);
    if (stepFlash.peerCells.length === 0) {
      return;
    }
    const peerCells = stepFlash.peerCells;
    const timeoutId = window.setTimeout(() => {
      setSuppressLastPeerNotes(false);
      triggerHintFlash(peerCells);
    }, MOVE_PEER_NOTES_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [stepFlash, triggerHintFlash]);

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

  const handleStepBack = () => {
    if (scrubDisabled) {
      return;
    }
    setIsPlaying(false);
    setCursor((current) => Math.max(0, current - 1));
  };

  const handleStepToStart = () => {
    if (scrubDisabled) {
      return;
    }
    setIsPlaying(false);
    setCursor(0);
  };

  const handleStepForward = () => {
    if (scrubDisabled) {
      return;
    }
    setIsPlaying(false);
    setCursor((current) => Math.min(maxCursor, current + 1));
  };

  const handleStepToEnd = () => {
    if (scrubDisabled) {
      return;
    }
    setIsPlaying(false);
    setCursor(maxCursor);
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
    handleStepBack,
    handleStepToStart,
    handleStepForward,
    handleStepToEnd,
    handleTogglePlay,
  };
}
