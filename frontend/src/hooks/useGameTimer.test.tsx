// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncGameProgress } from "@/api/games";
import { useGameTimer } from "@/hooks/useGameTimer";

vi.mock("@/api/games", () => ({
  syncGameProgress: vi.fn(async () => undefined),
}));

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useGameTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(syncGameProgress).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("syncs every 10 seconds, not every tick", () => {
    renderHook(() => useGameTimer({ gameId: "game", initialElapsedSeconds: 0, isRunning: true }));

    act(() => vi.advanceTimersByTime(9_000));
    expect(syncGameProgress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_000));
    expect(syncGameProgress).toHaveBeenCalledOnce();
    expect(vi.mocked(syncGameProgress).mock.calls[0][0]).toBe("game");
  });

  it("sends the unsynced seconds when the page hides or closes", () => {
    renderHook(() => useGameTimer({ gameId: "game", initialElapsedSeconds: 30, isRunning: true }));
    act(() => vi.advanceTimersByTime(4_000));

    act(() => setVisibility("hidden"));
    expect(syncGameProgress).toHaveBeenLastCalledWith("game", 34);

    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(syncGameProgress).toHaveBeenCalledTimes(2);
  });

  it("does not sync on becoming visible or while stopped", () => {
    const { rerender } = renderHook(
      ({ isRunning }) => useGameTimer({ gameId: "game", initialElapsedSeconds: 0, isRunning }),
      { initialProps: { isRunning: true } },
    );
    act(() => setVisibility("visible"));
    expect(syncGameProgress).not.toHaveBeenCalled();

    rerender({ isRunning: false });
    act(() => window.dispatchEvent(new Event("pagehide")));
    act(() => vi.advanceTimersByTime(20_000));
    expect(syncGameProgress).not.toHaveBeenCalled();
  });
});
