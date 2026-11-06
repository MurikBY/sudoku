import { useState, type ReactNode } from "react";

import { cn } from "@/lib/classNames";

type GameActionBarProps = {
  pencilActive: boolean;
  onTogglePencil: () => void;
  onClear: () => void;
  onHint: () => void;
  onUndo: () => void;
  canClear: boolean;
  canHint: boolean;
  canUndo: boolean;
  disabled?: boolean;
};

function ActionButton({
  label,
  disabled,
  pressed,
  tap,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  tap?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [pulse, setPulse] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      onClick={() => {
        if (tap && !disabled) {
          setPulse(false);
          window.requestAnimationFrame(() => setPulse(true));
        }
        onClick();
      }}
      onAnimationEnd={() => setPulse(false)}
      className={cn(
        "gazette-action-btn",
        pressed && "gazette-action-btn-active",
        disabled && "gazette-action-btn-disabled",
        tap && "gazette-action-btn-tap",
        pulse && "gazette-action-btn-pulse",
      )}
    >
      <span className="gazette-action-btn-stack">
        <span className="gazette-action-btn-glyph">{children}</span>
        <span className="gazette-action-btn-label">{label}</span>
      </span>
    </button>
  );
}

function PencilGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
    </svg>
  );
}

function EraserGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L12 21"
        strokeLinejoin="round"
      />
      <path d="M5.5 14.5 11 20" strokeLinecap="round" />
    </svg>
  );
}

function HintGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M9 18h6" strokeLinecap="round" />
      <path d="M10 22h4" strokeLinecap="round" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" strokeLinejoin="round" />
    </svg>
  );
}

function UndoGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 7v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 13a9 9 0 1 0 3-7.1L3 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GameActionBar({
  pencilActive,
  onTogglePencil,
  onClear,
  onHint,
  onUndo,
  canClear,
  canHint,
  canUndo,
  disabled,
}: GameActionBarProps) {
  return (
    <div className="gazette-action-bar">
      <ActionButton label="Hint" tap disabled={disabled || !canHint} onClick={onHint}>
        <HintGlyph />
      </ActionButton>
      <ActionButton label="Undo" tap disabled={disabled || !canUndo} onClick={onUndo}>
        <UndoGlyph />
      </ActionButton>
      <ActionButton label="Clear" tap disabled={disabled || !canClear} onClick={onClear}>
        <EraserGlyph />
      </ActionButton>
      <ActionButton
        label="Pencil"
        pressed={pencilActive}
        disabled={disabled}
        onClick={onTogglePencil}
      >
        <PencilGlyph />
      </ActionButton>
    </div>
  );
}
