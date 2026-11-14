import type { CellNotesMap, GameEvent } from "@/api/types";

export type ReplayBoardState = {
  currentGrid: string;
  notes: CellNotesMap;
};

export type ReplayEventsOptions = {
  suppressLastPeerNotes?: boolean;
};

function applyPeerNotes(
  notes: CellNotesMap,
  peerNotes: Record<string, number[]> | null | undefined,
): void {
  if (!peerNotes) {
    return;
  }
  for (const [cellKey, rawDigits] of Object.entries(peerNotes)) {
    const cell = Number(cellKey);
    if (!Number.isInteger(cell) || cell < 0 || cell > 80) {
      continue;
    }
    const remaining = [...new Set(rawDigits.filter((digit) => digit >= 1 && digit <= 9))].sort(
      (left, right) => left - right,
    );
    if (remaining.length > 0) {
      notes[cellKey] = remaining;
    } else {
      delete notes[cellKey];
    }
  }
}

export function peerNoteCellIndices(
  peerNotes: Record<string, number[]> | null | undefined,
): number[] {
  if (!peerNotes) {
    return [];
  }
  return Object.keys(peerNotes)
    .map((cellKey) => Number(cellKey))
    .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 80)
    .sort((left, right) => left - right);
}

export function replayEventsToState(
  puzzle: string,
  events: readonly GameEvent[],
  eventCount: number,
  options: ReplayEventsOptions = {},
): ReplayBoardState {
  if (eventCount < 0 || eventCount > events.length) {
    throw new Error("event count out of range");
  }
  const gridChars = puzzle.split("");
  const notes: CellNotesMap = {};
  for (const [eventIndex, event] of events.slice(0, eventCount).entries()) {
    const cell = event.cell;
    if (cell == null || cell < 0 || cell > 80) {
      continue;
    }
    const cellKey = String(cell);
    if (event.kind === "set" || event.kind === "hint") {
      const value = event.value;
      if (value == null || value < 1 || value > 9) {
        continue;
      }
      gridChars[cell] = String(value);
      delete notes[cellKey];
      const skipPeer = options.suppressLastPeerNotes === true && eventIndex === eventCount - 1;
      if (!skipPeer) {
        applyPeerNotes(notes, event.peer_notes);
      }
      continue;
    }
    if (event.kind === "clear") {
      gridChars[cell] = "0";
      delete notes[cellKey];
      continue;
    }
    if (event.kind === "notes") {
      const eventNotes = event.notes;
      if (eventNotes == null) {
        throw new Error(`notes event ${eventIndex} has no notes`);
      }
      if (gridChars[cell] !== "0") {
        continue;
      }
      const nextNotes = [...new Set(eventNotes.filter((digit) => digit >= 1 && digit <= 9))].sort(
        (left, right) => left - right,
      );
      if (nextNotes.length > 0) {
        notes[cellKey] = nextNotes;
      } else {
        delete notes[cellKey];
      }
    }
  }
  return {
    currentGrid: gridChars.join(""),
    notes,
  };
}
