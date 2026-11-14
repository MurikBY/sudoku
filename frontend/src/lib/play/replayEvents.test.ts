import { describe, expect, it } from "vitest";

import type { GameEvent } from "@/api/types";
import { peerNoteCellIndices, replayEventsToState } from "@/lib/play/replayEvents";

const EMPTY_PUZZLE = "0".repeat(81);

function replay(events: GameEvent[], eventCount = events.length, suppressLastPeerNotes = false) {
  return replayEventsToState(EMPTY_PUZZLE, events, eventCount, { suppressLastPeerNotes });
}

describe("replayEventsToState", () => {
  it("writes a set digit, deletes that cell's notes, and applies peer notes", () => {
    const state = replay([
      { kind: "notes", cell: 0, notes: [1, 2] },
      { kind: "set", cell: 0, value: 5, peer_notes: { "1": [3] } },
    ]);
    expect(state.currentGrid[0]).toBe("5");
    expect(state.notes["0"]).toBeUndefined();
    expect(state.notes["1"]).toEqual([3]);
  });

  it("treats a hint like a set", () => {
    const state = replay([
      { kind: "notes", cell: 0, notes: [1, 2] },
      { kind: "hint", cell: 0, value: 5, peer_notes: { "1": [3] } },
    ]);
    expect(state.currentGrid[0]).toBe("5");
    expect(state.notes["0"]).toBeUndefined();
    expect(state.notes["1"]).toEqual([3]);
  });

  it("skips peer notes on the last counted event only", () => {
    const events: GameEvent[] = [
      { kind: "set", cell: 0, value: 5, peer_notes: { "1": [2] } },
      { kind: "set", cell: 3, value: 6, peer_notes: { "4": [7] } },
    ];
    const both = replay(events, 2, true);
    expect(both.notes["1"]).toEqual([2]);
    expect(both.notes["4"]).toBeUndefined();
    expect(replay(events, 1, true).notes["1"]).toBeUndefined();
  });

  it("clears a cell back to zero and deletes its notes", () => {
    const clearedNotes = replay([
      { kind: "notes", cell: 4, notes: [1, 2] },
      { kind: "clear", cell: 4 },
    ]);
    expect(clearedNotes.currentGrid[4]).toBe("0");
    expect(clearedNotes.notes["4"]).toBeUndefined();
    const clearedDigit = replay([
      { kind: "set", cell: 4, value: 8, peer_notes: null },
      { kind: "clear", cell: 4 },
    ]);
    expect(clearedDigit.currentGrid[4]).toBe("0");
  });

  it("removes a peer's notes when its digit list is empty", () => {
    const state = replay([
      { kind: "notes", cell: 1, notes: [3, 4] },
      { kind: "set", cell: 0, value: 3, peer_notes: { "1": [] } },
    ]);
    expect(state.notes["1"]).toBeUndefined();
  });

  it("replaces notes on an empty cell and ignores notes on a filled cell", () => {
    const onEmpty = replay([{ kind: "notes", cell: 2, notes: [1, 3] }]);
    expect(onEmpty.notes["2"]).toEqual([1, 3]);
    const onDigit = replay([
      { kind: "set", cell: 2, value: 8, peer_notes: null },
      { kind: "notes", cell: 2, notes: [1, 3] },
    ]);
    expect(onDigit.currentGrid[2]).toBe("8");
    expect(onDigit.notes["2"]).toBeUndefined();
  });

  it("throws when the event count is outside the event list", () => {
    expect(() => replay([], -1)).toThrow(/event count out of range/);
    expect(() => replay([], 1)).toThrow(/event count out of range/);
  });
});

describe("peerNoteCellIndices", () => {
  it("returns the peer cells in order", () => {
    expect(peerNoteCellIndices({ "10": [1], "2": [] })).toEqual([2, 10]);
    expect(peerNoteCellIndices(null)).toEqual([]);
  });
});
