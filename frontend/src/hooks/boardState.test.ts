import { describe, expect, it } from "vitest";

import type { Game, PartyAssists } from "@/api/types";
import { boardReducer, initialBoardState, type BoardState } from "@/hooks/boardState";

const ASSISTS: PartyAssists = {
  pencil: false,
  highlight_peers: false,
  highlight_same_digit: false,
  mistake_feedback: false,
  dim_completed_digits: false,
  unit_complete_animation: false,
  auto_clear_notes: false,
  sticky_digit: false,
};

function game(patch: Partial<Game> = {}): Game {
  return {
    id: "game",
    difficulty: "easy",
    status: "in_progress",
    puzzle: "",
    current_grid: "",
    mistakes_count: 0,
    hints_count: 0,
    pencil_count: 0,
    notes: {},
    elapsed_seconds: 0,
    started_at: "",
    completed_at: null,
    party_id: null,
    assists: ASSISTS,
    share_code: "",
    is_analysis: false,
    analysis_source_game_id: null,
    is_lesson: false,
    lesson_technique: null,
    lesson_position_id: null,
    lesson_role: null,
    lesson_has_practice: null,
    lesson_objective_met: null,
    lesson_step: null,
    lesson_notes_issue: null,
    conflict_indices: [],
    wrong_digit_indices: [],
    undo_count: 0,
    completion: null,
    ...patch,
  };
}

function withSelection(state: BoardState, selectedIndex: number): BoardState {
  return { ...state, selectedIndex };
}

describe("boardReducer", () => {
  it("ignores select when the game is not in progress", () => {
    const state = withSelection(initialBoardState(game({ status: "completed" })), 4);
    expect(boardReducer(state, { type: "select", index: 1 }).selectedIndex).toBe(4);
  });

  it("clears the index when select is null during play", () => {
    const state = withSelection(initialBoardState(game()), 4);
    expect(boardReducer(state, { type: "select", index: null }).selectedIndex).toBeNull();
  });

  it("clears the selection and both index sets", () => {
    const state: BoardState = {
      ...withSelection(initialBoardState(game()), 4),
      conflictIndices: new Set([1]),
      wrongDigitIndices: new Set([2]),
    };
    const cleared = boardReducer(state, { type: "clearSelection" });
    expect(cleared.selectedIndex).toBeNull();
    expect(cleared.conflictIndices).toEqual(new Set());
    expect(cleared.wrongDigitIndices).toEqual(new Set());
  });

  it("toggles pencil mode", () => {
    const state = initialBoardState(game());
    expect(boardReducer(state, { type: "togglePencil" }).isPencilMode).toBe(true);
    expect(
      boardReducer({ ...state, isPencilMode: true }, { type: "togglePencil" }).isPencilMode,
    ).toBe(false);
  });

  it("replaces the game and both index sets", () => {
    const next = game({ conflict_indices: [1, 2], wrong_digit_indices: [3] });
    const replaced = boardReducer(initialBoardState(game({ conflict_indices: [8] })), {
      type: "replaceGame",
      game: next,
    });
    expect(replaced.game).toBe(next);
    expect(replaced.conflictIndices).toEqual(new Set([1, 2]));
    expect(replaced.wrongDigitIndices).toEqual(new Set([3]));
  });
});
