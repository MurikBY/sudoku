import { describe, expect, it } from "vitest";

import {
  addNoteDigit,
  boxIndex,
  cellIndex,
  completedUnitKeys,
  isGridFilled,
  peerIndices,
  rowCol,
  toggleNoteDigit,
} from "@/lib/play/sudokuGrid";

const SOLVED_GRID =
  "123456789456789123789123456214365897365897214897214365531642978642978531978531642";

describe("cell coordinates", () => {
  it("round-trips index through row and column", () => {
    for (let index = 0; index < 81; index += 1) {
      const { row, col } = rowCol(index);
      expect(cellIndex(row, col)).toBe(index);
    }
  });

  it("maps the centre cell to the centre box", () => {
    expect(boxIndex(4, 4)).toBe(4);
    expect(boxIndex(0, 8)).toBe(2);
    expect(boxIndex(8, 0)).toBe(6);
  });
});

describe("peerIndices", () => {
  it("returns 20 distinct peers that never include the cell itself", () => {
    const peers = peerIndices(40);
    expect(peers).toHaveLength(20);
    expect(new Set(peers).size).toBe(20);
    expect(peers).not.toContain(40);
  });

  it("covers the row, column, and box of a corner cell", () => {
    const peers = peerIndices(0);
    expect(peers).toEqual(expect.arrayContaining([1, 8, 9, 72, 10, 20]));
  });
});

describe("completedUnitKeys", () => {
  it("marks every unit complete on a solved grid without errors", () => {
    const keys = completedUnitKeys(SOLVED_GRID, new Set(), new Set());
    expect(keys.size).toBe(27);
  });

  it("excludes units touched by a conflict", () => {
    const keys = completedUnitKeys(SOLVED_GRID, new Set([0]), new Set());
    expect(keys.has("row:0")).toBe(false);
    expect(keys.has("col:0")).toBe(false);
    expect(keys.has("box:0")).toBe(false);
    expect(keys.has("row:1")).toBe(true);
  });

  it("excludes units with an empty cell", () => {
    const grid = `0${SOLVED_GRID.slice(1)}`;
    expect(isGridFilled(grid)).toBe(false);
    expect(completedUnitKeys(grid, new Set(), new Set()).has("row:0")).toBe(false);
  });
});

describe("note digits", () => {
  it("toggles a digit in and out keeping the list sorted", () => {
    expect(toggleNoteDigit([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleNoteDigit([1, 3, 5], 3)).toEqual([1, 5]);
  });

  it("adds a digit once", () => {
    expect(addNoteDigit([2], 2)).toEqual([2]);
    expect(addNoteDigit([9], 2)).toEqual([2, 9]);
  });

  it("rejects digits outside 1-9", () => {
    expect(() => toggleNoteDigit([], 0)).toThrow("note digit out of range");
    expect(() => addNoteDigit([], 10)).toThrow("note digit out of range");
  });
});
