import { describe, expect, it } from "vitest";

import { boardView, type BoardViewInput } from "@/lib/play/boardView";

const SOLVED_GRID =
  "123456789456789123789123456214365897365897214897214365531642978642978531978531642";

function viewInput(overrides: Partial<BoardViewInput> = {}): BoardViewInput {
  return {
    puzzle: SOLVED_GRID,
    currentGrid: SOLVED_GRID,
    notes: {},
    dimCompletedDigits: false,
    mistakeFeedback: true,
    stickyAssist: true,
    isPlaying: true,
    showLessonSuccess: false,
    selectedIndex: 0,
    isPencilMode: false,
    conflictIndices: new Set(),
    wrongDigitIndices: new Set(),
    stickyDigit: null,
    ...overrides,
  };
}

function withEmpty(index: number): { puzzle: string; currentGrid: string } {
  const puzzle = SOLVED_GRID.split("");
  const currentGrid = SOLVED_GRID.split("");
  puzzle[index] = "0";
  currentGrid[index] = "0";
  return { puzzle: puzzle.join(""), currentGrid: currentGrid.join("") };
}

function playerCell(index: number): { puzzle: string; currentGrid: string } {
  const puzzle = SOLVED_GRID.split("");
  puzzle[index] = "0";
  return { puzzle: puzzle.join(""), currentGrid: SOLVED_GRID };
}

describe("boardView", () => {
  it("enables the pad and the hint on an empty selected cell", () => {
    const view = boardView(viewInput({ ...withEmpty(1), selectedIndex: 1 }));

    expect(view.canUsePad).toBe(true);
    expect(view.canClear).toBe(false);
    expect(view.canHint).toBe(true);
    expect(view.activeDigit).toBeNull();
    expect(view.noteDigits.size).toBe(0);
    expect(view.notePaintEnabled).toBe(false);
  });

  it("lets a digit replace a filled cell and blocks pencil on that cell", () => {
    const filled = playerCell(1);

    expect(boardView(viewInput({ ...filled, selectedIndex: 1 })).canUsePad).toBe(true);
    expect(
      boardView(viewInput({ ...filled, selectedIndex: 1, isPencilMode: true })).canUsePad,
    ).toBe(false);
  });

  it("allows pencil only on an empty editable cell", () => {
    expect(
      boardView(viewInput({ ...withEmpty(1), selectedIndex: 1, isPencilMode: true })).canUsePad,
    ).toBe(true);
  });

  it("blocks the pad and clear on a given cell", () => {
    const view = boardView(viewInput({ selectedIndex: 0 }));

    expect(view.canUsePad).toBe(false);
    expect(view.canClear).toBe(false);
    expect(view.activeDigit).toBe(1);
  });

  it("locks clear on a correct digit and releases it when feedback is off or the digit is wrong", () => {
    const filled = playerCell(1);

    expect(boardView(viewInput({ ...filled, selectedIndex: 1 })).canClear).toBe(false);
    expect(
      boardView(viewInput({ ...filled, selectedIndex: 1, mistakeFeedback: false })).canClear,
    ).toBe(true);
    expect(
      boardView(
        viewInput({
          ...filled,
          selectedIndex: 1,
          wrongDigitIndices: new Set([1]),
        }),
      ).canClear,
    ).toBe(true);
  });

  it("clears a cell that only has notes and reads those notes", () => {
    const view = boardView(
      viewInput({
        ...withEmpty(4),
        selectedIndex: 4,
        notes: { "4": [1, 8] },
      }),
    );

    expect(view.canClear).toBe(true);
    expect(view.noteDigits).toEqual(new Set([1, 8]));
    expect(view.activeDigit).toBeNull();
  });

  it("hides the pad and the hint during lesson success and still allows clear and note paint", () => {
    const view = boardView(
      viewInput({
        ...withEmpty(1),
        selectedIndex: 1,
        notes: { "1": [7] },
        showLessonSuccess: true,
        isPencilMode: true,
        stickyDigit: 4,
      }),
    );

    expect(view.canUsePad).toBe(false);
    expect(view.canHint).toBe(false);
    expect(view.canClear).toBe(true);
    expect(view.notePaintEnabled).toBe(true);
  });

  it("turns the pad, clear, hint, and note paint off when play has stopped", () => {
    const view = boardView(
      viewInput({
        ...playerCell(1),
        selectedIndex: 1,
        mistakeFeedback: false,
        isPlaying: false,
        isPencilMode: true,
        stickyDigit: 3,
      }),
    );

    expect(view.canUsePad).toBe(false);
    expect(view.canClear).toBe(false);
    expect(view.canHint).toBe(false);
    expect(view.notePaintEnabled).toBe(false);
  });

  it("returns no active digit and no notes when nothing is selected", () => {
    const view = boardView(viewInput({ selectedIndex: null }));

    expect(view.canUsePad).toBe(false);
    expect(view.canClear).toBe(false);
    expect(view.canHint).toBe(true);
    expect(view.activeDigit).toBeNull();
    expect(view.noteDigits.size).toBe(0);
  });

  it("dims every completed digit and drops a digit touched by a conflict", () => {
    const all = boardView(viewInput({ dimCompletedDigits: true }));
    const conflicted = boardView(
      viewInput({ dimCompletedDigits: true, conflictIndices: new Set([0]) }),
    );
    const hidden = boardView(viewInput({ dimCompletedDigits: false }));

    expect([...all.padCompletedDigits].sort((left, right) => left - right)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(conflicted.padCompletedDigits.has(1)).toBe(false);
    expect(conflicted.padCompletedDigits.size).toBe(8);
    expect(hidden.padCompletedDigits.size).toBe(0);
  });

  it("passes the wrong-digit set through only while mistake feedback is on", () => {
    const wrong = new Set([4]);

    expect(boardView(viewInput({ wrongDigitIndices: wrong })).visibleWrongDigitIndices).toBe(wrong);
    expect(
      boardView(viewInput({ wrongDigitIndices: wrong, mistakeFeedback: false }))
        .visibleWrongDigitIndices.size,
    ).toBe(0);
  });

  it("enables note paint only for a locked digit in pencil while the assist is on", () => {
    const enabled = viewInput({ isPencilMode: true, stickyDigit: 6 });

    expect(boardView(enabled).notePaintEnabled).toBe(true);
    expect(boardView({ ...enabled, stickyDigit: null }).notePaintEnabled).toBe(false);
    expect(boardView({ ...enabled, isPencilMode: false }).notePaintEnabled).toBe(false);
    expect(boardView({ ...enabled, stickyAssist: false }).notePaintEnabled).toBe(false);
    expect(boardView({ ...enabled, isPlaying: false }).notePaintEnabled).toBe(false);
  });
});
