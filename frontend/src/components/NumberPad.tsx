import { useStickyLongPress } from "@/hooks/useStickyLongPress";
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

type PadKeyProps = {
  digit: number;
  disabled: boolean;
  canStick: boolean;
  isSticky: boolean;
  isActive: boolean;
  isCompleted: boolean;
  longPress: ReturnType<typeof useStickyLongPress>;
  onPick: (digit: number) => void;
};

function PadKey({
  digit,
  disabled,
  canStick,
  isSticky,
  isActive,
  isCompleted,
  longPress,
  onPick,
}: PadKeyProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "gazette-pad-key",
        isSticky && "gazette-pad-key-sticky",
        !isSticky && isActive && "gazette-pad-key-active",
        isCompleted && "gazette-pad-key-completed",
      )}
      aria-pressed={isSticky}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) {
          return;
        }
        longPress.startPress(digit, canStick);
      }}
      onPointerUp={longPress.clearLongPress}
      onPointerLeave={longPress.clearLongPress}
      onPointerCancel={longPress.clearLongPress}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        if (longPress.consumeSuppressedClick() || disabled) {
          return;
        }
        onPick(digit);
      }}
    >
      {digit}
    </button>
  );
}

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
  const longPress = useStickyLongPress(onStickyDigit);

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
            return (
              <PadKey
                key={digit}
                digit={digit}
                disabled={isKeyDisabled}
                canStick={stickyEnabled && !isKeyDisabled}
                isSticky={stickyDigit === digit}
                isActive={pencilActive ? noteDigits.has(digit) : activeDigit === digit}
                isCompleted={isCompleted}
                longPress={longPress}
                onPick={onPick}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
