// @vitest-environment jsdom

import type { Dispatch } from "react";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCellNotes } from "@/api/games";
import type { Game, PartyAssists } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { useNotes } from "@/hooks/useNotes";

vi.mock("@/api/games", () => ({
  setCellNotes: vi.fn(),
}));

const EMPTY_GRID = "0".repeat(81);

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

function playingGame(patch: Partial<Game> = {}): Game {
  return {
    id: "game",
    difficulty: "easy",
    status: "in_progress",
    puzzle: EMPTY_GRID,
    current_grid: EMPTY_GRID,
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

function deferred() {
  let resolveGate: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  return { promise, resolve: () => resolveGate() };
}

function createBoardQueue() {
  let chain: Promise<unknown> = Promise.resolve();
  return function enqueueBoardAction<T>(action: () => Promise<T>): Promise<T> {
    const queued = chain.then(action, action);
    chain = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  };
}

describe("useNotes addNote", () => {
  beforeEach(() => {
    vi.mocked(setCellNotes).mockReset();
  });

  it("sends the post-move notes plus the painted digit", async () => {
    const gameRef = { current: playingGame({ notes: { "0": [1, 9] } }) };
    const dispatch: Dispatch<BoardAction> = vi.fn();
    const enqueueBoardAction = createBoardQueue();
    const gate = deferred();
    vi.mocked(setCellNotes).mockImplementation(async (_gameId, cellIndex, digits) =>
      playingGame({ notes: { [String(cellIndex)]: [...digits] } }),
    );

    const { result } = renderHook(() =>
      useNotes({
        enqueueBoardAction,
        gameRef,
        selectedIndexRef: { current: null },
        dispatch,
      }),
    );

    const movePromise = enqueueBoardAction(async () => {
      const serverGame = { ...gameRef.current, notes: { "0": [1] } };
      await gate.promise;
      gameRef.current = serverGame;
    });
    await Promise.resolve();

    const notesPromise = result.current.addNote(5, 8, 0);
    expect(gameRef.current.notes).toEqual({ "0": [1, 5, 9] });

    gate.resolve();
    await movePromise;
    await notesPromise;

    expect(setCellNotes).toHaveBeenCalledTimes(1);
    expect(setCellNotes).toHaveBeenCalledWith("game", 0, [1, 5], 8);
  });

  it("shows the server's notes for the cell, none when the answer omits it", async () => {
    const gameRef = { current: playingGame({ notes: { "0": [1], "1": [4] } }) };
    vi.mocked(setCellNotes).mockResolvedValue(playingGame({ notes: { "1": [4] } }));

    const { result } = renderHook(() =>
      useNotes({
        enqueueBoardAction: createBoardQueue(),
        gameRef,
        selectedIndexRef: { current: null },
        dispatch: vi.fn(),
      }),
    );

    await result.current.addNote(5, 1, 0);

    expect(setCellNotes).toHaveBeenCalledWith("game", 0, [1, 5], 1);
    expect(gameRef.current.notes).toEqual({ "1": [4] });
  });

  it("drops the painted digit from the latest notes when the request fails", async () => {
    const gameRef = { current: playingGame({ notes: { "0": [1, 2] } }) };
    const dispatch: Dispatch<BoardAction> = vi.fn();
    let requestCount = 0;
    let rejectRequest: (error: unknown) => void = () => {
      throw new Error("notes request was not called");
    };
    vi.mocked(setCellNotes).mockImplementation((_gameId, cellIndex, digits) => {
      requestCount += 1;
      if (requestCount === 1) {
        return new Promise<Game>((_resolve, reject) => {
          rejectRequest = reject;
        });
      }
      return Promise.resolve(playingGame({ notes: { [String(cellIndex)]: [...digits] } }));
    });

    const { result } = renderHook(() =>
      useNotes({
        enqueueBoardAction: createBoardQueue(),
        gameRef,
        selectedIndexRef: { current: null },
        dispatch,
      }),
    );

    const notesPromise = result.current.addNote(5, 1, 0);
    await Promise.resolve();
    const laterPaint = result.current.addNote(7, 1, 0);

    rejectRequest(new Error("offline"));
    await notesPromise;

    expect(setCellNotes).toHaveBeenCalledTimes(1);
    expect(gameRef.current.notes).toEqual({ "0": [1, 2, 7] });

    await laterPaint;
    expect(setCellNotes).toHaveBeenLastCalledWith("game", 0, [1, 2, 7], 1);
  });
});
