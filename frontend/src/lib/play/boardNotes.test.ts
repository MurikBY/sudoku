import { describe, expect, it } from "vitest";

import {
  mergedCellNotes,
  notesWithCellDigits,
  peerNoteClearIndices,
  shouldAutoComplete,
} from "@/lib/play/boardNotes";

const FULL_GRID = "123456789".repeat(9);

describe("peerNoteClearIndices", () => {
  it("lists a peer whose digits changed and skips the moved cell", () => {
    const changed = peerNoteClearIndices({ "0": [9], "1": [1, 2] }, { "0": [8], "1": [1] }, 0);
    expect(changed).toContain(1);
    expect(changed).not.toContain(0);
  });

  it("does not list a peer missing from both maps", () => {
    const changed = peerNoteClearIndices({}, {}, 0);
    expect(changed).not.toContain(9);
  });
});

describe("shouldAutoComplete", () => {
  it("is true only when the grid is full and both index lists are empty", () => {
    expect(
      shouldAutoComplete({
        current_grid: FULL_GRID,
        conflict_indices: [],
        wrong_digit_indices: [],
      }),
    ).toBe(true);
    expect(
      shouldAutoComplete({
        current_grid: `${FULL_GRID.slice(0, 80)}0`,
        conflict_indices: [],
        wrong_digit_indices: [],
      }),
    ).toBe(false);
    expect(
      shouldAutoComplete({
        current_grid: FULL_GRID,
        conflict_indices: [0],
        wrong_digit_indices: [],
      }),
    ).toBe(false);
    expect(
      shouldAutoComplete({
        current_grid: FULL_GRID,
        conflict_indices: [],
        wrong_digit_indices: [1],
      }),
    ).toBe(false);
  });
});

describe("notesWithCellDigits", () => {
  it("deletes the key for an empty digit list and copies the digits otherwise", () => {
    const digits = [2, 4];
    const withDigits = notesWithCellDigits({ "1": [9] }, 0, digits);
    expect(withDigits).toEqual({ "0": [2, 4], "1": [9] });
    expect(withDigits["0"]).not.toBe(digits);
    expect(notesWithCellDigits({ "0": [2, 4], "1": [9] }, 0, [])).toEqual({ "1": [9] });
  });
});

describe("mergedCellNotes", () => {
  it("keeps an optimistic digit on another cell", () => {
    expect(mergedCellNotes({ "0": [9], "1": [4] }, 0, [1, 2])).toEqual({
      "0": [1, 2],
      "1": [4],
    });
  });

  it("stores an empty digit list without deleting the key", () => {
    expect(mergedCellNotes({ "0": [1], "1": [4] }, 0, [])).toEqual({
      "0": [],
      "1": [4],
    });
  });
});
