// @vitest-environment jsdom

import type { Dispatch } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { completeGame, moveCell } from "@/api/games";
import type { Game, MoveCellResponse, PartyAssists } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { useBoardMoves } from "@/hooks/useBoardMoves";
import { ApiError } from "@/lib/api/apiError";
import { queryRetryDelayMs } from "@/lib/api/queryLoadStatus";

vi.mock("@/api/games", () => ({
  completeGame: vi.fn(),
  moveCell: vi.fn(),
  requestHint: vi.fn(),
}));

const EMPTY_GRID = "0".repeat(81);
const FULL_GRID = "123456789".repeat(9);

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

function completedGame(): Game {
  return playingGame({
    status: "completed",
    current_grid: FULL_GRID,
    completed_at: "2026-11-03T00:00:00Z",
    elapsed_seconds: 12,
  });
}

function solvedMove(): MoveCellResponse {
  return { ...playingGame({ current_grid: FULL_GRID, elapsed_seconds: 8 }), is_mistake: false };
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

function renderMoves(game: Game = playingGame()) {
  const gameRef = { current: game };
  const dispatch: Dispatch<BoardAction> = vi.fn();
  const enqueueBoardAction = createBoardQueue();
  const onGameStateChanged = vi.fn();
  const hook = renderHook(() =>
    useBoardMoves({
      enqueueBoardAction,
      gameRef,
      selectedIndexRef: { current: 0 },
      dispatch,
      flashCells: vi.fn(),
      setHintPending: vi.fn(),
      onGameStateChanged,
    }),
  );
  return { ...hook, dispatch, enqueueBoardAction, gameRef, onGameStateChanged };
}

function dispatched(dispatch: Dispatch<BoardAction>): BoardAction[] {
  return vi.mocked(dispatch).mock.calls.map((call) => call[0]);
}

describe("useBoardMoves completion", () => {
  beforeEach(() => {
    vi.mocked(completeGame).mockReset();
    vi.mocked(moveCell).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries three times and then says there is no connection", async () => {
    vi.useFakeTimers();
    vi.mocked(completeGame).mockRejectedValue(new ApiError("network", null));
    const { result, dispatch } = renderMoves();

    const pending = result.current.finishCompletedGame("game", 12);
    await vi.advanceTimersByTimeAsync(0);
    expect(completeGame).toHaveBeenCalledTimes(1);
    expect(dispatched(dispatch)).toEqual([
      { type: "clearError" },
      { type: "setPhase", phase: "completing" },
    ]);

    await vi.advanceTimersByTimeAsync(queryRetryDelayMs(0) - 1);
    expect(completeGame).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(completeGame).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(queryRetryDelayMs(1) - 1);
    expect(completeGame).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(completeGame).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(queryRetryDelayMs(2) - 1);
    expect(completeGame).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(completeGame).toHaveBeenCalledTimes(4);

    await expect(pending).resolves.toBeNull();
    expect(completeGame).toHaveBeenNthCalledWith(4, "game", 12);
    expect(dispatched(dispatch)).toEqual([
      { type: "clearError" },
      { type: "setPhase", phase: "completing" },
      { type: "setPhase", phase: "playing" },
      { type: "setError", error: "No connection." },
    ]);
  });

  it("stores the completed game when a later attempt succeeds", async () => {
    vi.useFakeTimers();
    const finished = completedGame();
    vi.mocked(completeGame)
      .mockRejectedValueOnce(new ApiError("server", 500))
      .mockResolvedValueOnce(finished);
    const { result, dispatch, gameRef, onGameStateChanged } = renderMoves();

    const pending = result.current.finishCompletedGame("game", 12);
    await vi.advanceTimersByTimeAsync(queryRetryDelayMs(0));

    await expect(pending).resolves.toBe(finished);
    expect(completeGame).toHaveBeenCalledTimes(2);
    expect(completeGame).toHaveBeenNthCalledWith(2, "game", 12);
    expect(gameRef.current).toBe(finished);
    expect(onGameStateChanged).toHaveBeenCalledTimes(1);
    expect(dispatched(dispatch)).toEqual([
      { type: "clearError" },
      { type: "setPhase", phase: "completing" },
      { type: "storeGame", game: finished },
      { type: "clearSelection" },
      { type: "setPhase", phase: "completed" },
    ]);
  });

  it("fails a conflict or a validation error without retrying", async () => {
    const { result, dispatch } = renderMoves();

    vi.mocked(completeGame).mockRejectedValueOnce(new ApiError("conflict", 409));
    await expect(result.current.finishCompletedGame("game", 4)).resolves.toBeNull();

    vi.mocked(completeGame).mockRejectedValueOnce(new ApiError("validation", 422));
    await expect(result.current.finishCompletedGame("game", 4)).resolves.toBeNull();

    expect(completeGame).toHaveBeenCalledTimes(2);
    expect(dispatched(dispatch)).toEqual([
      { type: "clearError" },
      { type: "setPhase", phase: "completing" },
      { type: "setPhase", phase: "playing" },
      { type: "setError", error: "That action is no longer possible." },
      { type: "clearError" },
      { type: "setPhase", phase: "completing" },
      { type: "setPhase", phase: "playing" },
      { type: "setError", error: "That request was rejected." },
    ]);
  });

  it("sends nothing when a second completion starts while one is in flight", async () => {
    let resolveComplete: (game: Game) => void = () => {
      throw new Error("completeGame was not called");
    };
    vi.mocked(completeGame).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveComplete = resolve;
        }),
    );
    const { result } = renderMoves();
    const finished = completedGame();

    const first = result.current.finishCompletedGame("game", 3);
    const second = result.current.finishCompletedGame("game", 9);

    await expect(second).resolves.toBeNull();
    expect(completeGame).toHaveBeenCalledTimes(1);
    expect(completeGame).toHaveBeenCalledWith("game", 3);

    resolveComplete(finished);
    await expect(first).resolves.toBe(finished);
    expect(completeGame).toHaveBeenCalledTimes(1);
  });

  it("waits for an earlier board action before completing", async () => {
    vi.mocked(completeGame).mockResolvedValue(completedGame());
    const { result, enqueueBoardAction } = renderMoves();
    const gate = deferred();

    const leading = enqueueBoardAction(async () => {
      await gate.promise;
    });
    const completion = result.current.finishCompletedGame("game", 6);
    await Promise.resolve();
    expect(completeGame).not.toHaveBeenCalled();

    gate.resolve();
    await leading;
    await completion;
    expect(completeGame).toHaveBeenCalledExactlyOnceWith("game", 6);
  });

  it("completes from a solved move without blocking the next board action", async () => {
    vi.useFakeTimers();
    const finished = completedGame();
    vi.mocked(moveCell).mockResolvedValue(solvedMove());
    vi.mocked(completeGame)
      .mockRejectedValueOnce(new ApiError("timeout", null))
      .mockResolvedValueOnce(finished);
    const { result, enqueueBoardAction, gameRef } = renderMoves();

    const movePromise = result.current.applyMove(5, 8, 0);
    let seenStatus = "";
    const followPromise = enqueueBoardAction(async () => {
      seenStatus = gameRef.current.status;
    });
    await vi.advanceTimersByTimeAsync(queryRetryDelayMs(0));
    await movePromise;
    await followPromise;

    expect(moveCell).toHaveBeenCalledExactlyOnceWith("game", 0, 5, 8);
    expect(completeGame).toHaveBeenCalledTimes(2);
    expect(completeGame).toHaveBeenNthCalledWith(1, "game", 8);
    expect(seenStatus).toBe("completed");
  });
});
