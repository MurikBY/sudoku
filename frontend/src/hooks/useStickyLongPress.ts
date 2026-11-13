import { useRef } from "react";

const STICKY_LONG_PRESS_MS = 420;

// A long press on a pad key makes its digit sticky, and the click that ends that press is
// swallowed so it does not also place the digit.
export function useStickyLongPress(onStickyDigit: ((digit: number) => void) | undefined) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressDigitRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  function clearLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressDigitRef.current = null;
  }

  function startPress(digit: number, canStick: boolean) {
    suppressClickRef.current = false;
    clearLongPress();
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

  function consumeSuppressedClick(): boolean {
    if (!suppressClickRef.current) {
      return false;
    }
    suppressClickRef.current = false;
    return true;
  }

  return { startPress, clearLongPress, consumeSuppressedClick };
}
