import { useEffect, useState } from "react";

import type { GameEvent } from "@/api/types";
import { MOVE_PEER_NOTES_DELAY_MS, useHintFlash } from "@/hooks/useHintFlash";
import { peerNoteCellIndices } from "@/lib/play/replayEvents";

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
  const peerCells =
    event.kind === "set" || event.kind === "hint" ? peerNoteCellIndices(event.peer_notes) : [];
  return { eventCell: event.cell, peerCells };
}

// A single step forward flashes its cell. A digit that cleared peer notes keeps those notes
// on screen for a beat, then clears them with a second flash, as it looked during play.
export function useReplayFlashes(events: GameEvent[], cursor: number) {
  const [trackedCursor, setTrackedCursor] = useState(0);
  const [stepFlash, setStepFlash] = useState<ReplayStepFlash | null>(null);
  const [suppressLastPeerNotes, setSuppressLastPeerNotes] = useState(false);
  const { flashedCellIndices, triggerHintFlash } = useHintFlash();

  if (cursor !== trackedCursor) {
    const flash = replayStepFlash(events, trackedCursor, cursor);
    setTrackedCursor(cursor);
    setSuppressLastPeerNotes(flash !== null && flash.peerCells.length > 0);
    setStepFlash(flash);
  }

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

  return { suppressLastPeerNotes, flashedCellIndices };
}
