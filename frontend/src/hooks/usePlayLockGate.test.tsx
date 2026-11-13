// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlayLock } from "@/hooks/usePlayLock";
import { usePlayLockGate } from "@/hooks/usePlayLockGate";

vi.mock("@/hooks/usePlayLock", () => ({ usePlayLock: vi.fn() }));
vi.mock("@/api/playLock", () => ({ fetchPlayLockStatus: vi.fn() }));

const acquire = vi.fn<() => Promise<boolean>>();
const release = vi.fn(async () => undefined);

function renderGate(onError = vi.fn()) {
  return renderHook(() => usePlayLockGate({ onError }));
}

describe("usePlayLockGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePlayLock).mockReturnValue({ acquire, release });
  });

  it("resolves a lost lock once until the next acquire", async () => {
    const resolveConflict = vi.fn();
    const { result } = renderGate();
    act(() => result.current.setLockConflictHandler(() => resolveConflict));

    act(() => result.current.reportLockConflict());
    act(() => result.current.reportLockConflict());
    expect(resolveConflict).toHaveBeenCalledTimes(1);

    acquire.mockResolvedValue(true);
    await act(async () => {
      await result.current.acquirePlayLock();
    });
    act(() => result.current.reportLockConflict());
    expect(resolveConflict).toHaveBeenCalledTimes(2);
  });

  it("does not count a conflict the current screen ignores", () => {
    const resolveConflict = vi.fn();
    let stay = true;
    const { result } = renderGate();
    act(() => result.current.setLockConflictHandler(() => (stay ? null : resolveConflict)));

    act(() => result.current.reportLockConflict());
    stay = false;
    act(() => result.current.reportLockConflict());

    expect(resolveConflict).toHaveBeenCalledTimes(1);
  });

  it("marks the lock as held elsewhere when acquiring conflicts", async () => {
    acquire.mockResolvedValue(false);
    const { result } = renderGate();

    let attempt: string | undefined;
    await act(async () => {
      attempt = await result.current.ensurePlayLock();
    });

    expect(attempt).toBe("conflict");
    expect(result.current.playLockedByOther).toBe(true);
  });

  it("reports a failed acquire as an error", async () => {
    acquire.mockRejectedValue(new Error("boom"));
    const onError = vi.fn();
    const { result } = renderGate(onError);

    let attempt: string | undefined;
    await act(async () => {
      attempt = await result.current.ensurePlayLock();
    });

    expect(attempt).toBe("failed");
    expect(onError).toHaveBeenCalledOnce();
  });
});
