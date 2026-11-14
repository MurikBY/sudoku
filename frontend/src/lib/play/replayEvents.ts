import type { CellNotesMap, GameEvent } from "@/api/types";

export type ReplayBoardState = {
  currentGrid: string;
  notes: CellNotesMap;
};

export type ReplayEventsOptions = {
  suppressLastPeerNotes?: boolean;
};

type PeerNotes = Record<string, number[]> | null;

// The server validates every event before it sends one, so replay only applies them.
// Same rule as the server replay: digits sorted and unique, an empty list removes the notes.
function writeCellNotes(notes: CellNotesMap, cellKey: string, digits: readonly number[]): void {
  const uniqueDigits = [...new Set(digits)].sort((left, right) => left - right);
  if (uniqueDigits.length > 0) {
    notes[cellKey] = uniqueDigits;
  } else {
    delete notes[cellKey];
  }
}

function applyPeerNotes(notes: CellNotesMap, peerNotes: PeerNotes): void {
  if (peerNotes === null) {
    return;
  }
  for (const [cellKey, digits] of Object.entries(peerNotes)) {
    writeCellNotes(notes, cellKey, digits);
  }
}

export function peerNoteCellIndices(peerNotes: PeerNotes): number[] {
  if (peerNotes === null) {
    return [];
  }
  return Object.keys(peerNotes)
    .map((cellKey) => Number(cellKey))
    .sort((left, right) => left - right);
}

function replayEvent(
  gridChars: string[],
  notes: CellNotesMap,
  event: GameEvent,
  applyPeers: boolean,
): void {
  const cellKey = String(event.cell);
  switch (event.kind) {
    case "set":
    case "hint":
      gridChars[event.cell] = String(event.value);
      delete notes[cellKey];
      if (applyPeers) {
        applyPeerNotes(notes, event.peer_notes);
      }
      return;
    case "clear":
      gridChars[event.cell] = "0";
      delete notes[cellKey];
      return;
    case "notes":
      if (gridChars[event.cell] === "0") {
        writeCellNotes(notes, cellKey, event.notes);
      }
      return;
    default: {
      const unknownEvent: never = event;
      throw new Error(`unknown replay event: ${JSON.stringify(unknownEvent)}`);
    }
  }
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
    const skipPeers = options.suppressLastPeerNotes === true && eventIndex === eventCount - 1;
    replayEvent(gridChars, notes, event, !skipPeers);
  }
  return {
    currentGrid: gridChars.join(""),
    notes,
  };
}
