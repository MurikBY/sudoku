// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NumberPad } from "@/components/NumberPad";

const STICKY_LONG_PRESS_MS = 420;

afterEach(() => {
  vi.useRealTimers();
});

describe("NumberPad", () => {
  it("calls onPick with the digit of an enabled key", async () => {
    const user = userEvent.setup({ delay: null });
    const onPick = vi.fn();
    render(<NumberPad onPick={onPick} completedDigits={new Set([9])} />);

    await user.click(screen.getByRole("button", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "9" }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith(5);
  });

  it("calls onStickyDigit when a key is held and does not pick it", () => {
    vi.useFakeTimers();
    const onPick = vi.fn();
    const onStickyDigit = vi.fn();
    render(<NumberPad onPick={onPick} onStickyDigit={onStickyDigit} />);
    const key = screen.getByRole("button", { name: "4" });

    fireEvent.pointerDown(key, { button: 0 });
    vi.advanceTimersByTime(STICKY_LONG_PRESS_MS);
    fireEvent.pointerUp(key);
    fireEvent.click(key);

    expect(onStickyDigit).toHaveBeenCalledExactlyOnceWith(4);
    expect(onPick).not.toHaveBeenCalled();
  });
});
