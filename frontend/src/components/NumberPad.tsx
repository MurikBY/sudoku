import { useRef } from "react";

import { cn } from "@/lib/classNames";

type NumberPadProps = {
  onPick: (digit: number) => void;
  onStickyDigit?: (digit: number) => void;
  stickyEnabled?: boolean;
  disabled?: boolean;
  activeDigit?: number | null;
  stickyDigit?: number | null;
  noteDigits?: ReadonlySet<number>;
  completedDigits?: ReadonlySet<number>;
  pencilActive?: boolean;
};

const PAD_ROWS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9],
] as const;

const STICKY_LONG_PRESS_MS = 420;

export function NumberPad({
  onPick,
  onStickyDigit,
  stickyEnabled = true,
  disabled,
  activeDigit = null,
  stickyDigit = null,
  noteDigits = new Set(),
  completedDigits = new Set(),
  pencilActive = false,
}: NumberPadProps) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressDigitRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressDigitRef.current = null;
  }

  function startLongPress(digit: number, canStick: boolean) {
    clearLongPressTimer();
    if (!canStick || !onStickyDigit) {
      return;
    }
    longPressDigitRef.current = digit;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      if (longPressDigitRef.current !== digit) {
        return;
      }
      suppressClickRef.current = true;
      onStickyDigit(digit);
    }, STICKY_LONG_PRESS_MS);
  }

  return (
    <div className={cn("gazette-pad", pencilActive && "gazette-pad-pencil-mode")}>
      {PAD_ROWS.map((row) => (
        <div
          key={row.join("-")}
          className={cn(
            "gazette-pad-row",
            row.length === 5 ? "gazette-pad-row-five" : "gazette-pad-row-four",
          )}
        >
          {row.map((digit) => {
            const isCompleted = completedDigits.has(digit);
            const isKeyDisabled = Boolean(disabled || isCompleted);
            const canStick = stickyEnabled && !isKeyDisabled;
            const isSticky = stickyDigit === digit;
            const isActive = pencilActive ? noteDigits.has(digit) : activeDigit === digit;

            return (
              <button
                key={digit}
                type="button"
                disabled={isKeyDisabled}
                className={cn(
                  "gazette-pad-key",
                  isSticky && "gazette-pad-key-sticky",
                  !isSticky && isActive && "gazette-pad-key-active",
                  isCompleted && "gazette-pad-key-completed",
                )}
                aria-pressed={isSticky}
                onPointerDown={(event) => {
                  if (isKeyDisabled || event.button !== 0) {
                    return;
                  }
                  suppressClickRef.current = false;
                  startLongPress(digit, canStick);
                }}
                onPointerUp={clearLongPressTimer}
                onPointerLeave={clearLongPressTimer}
                onPointerCancel={clearLongPressTimer}
                onContextMenu={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (isKeyDisabled) {
                    return;
                  }
                  onPick(digit);
                }}
              >
                {digit}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
