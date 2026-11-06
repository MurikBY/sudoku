import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { LabeledMetric } from "@/components/LabeledMetric";
import { formatByNickname } from "@/lib/format/formatByNickname";
import type { PlayMode } from "@/lib/play/playMode";

const TOOLBAR_MODE_HINT_MS = 2500;

type ToolbarModeHint = "sticky" | "pencil";

type GameToolbarProps = {
  formattedElapsed: string;
  mistakesCount: number;
  hintsCount: number;
  showMistakes: boolean;
  isPaused?: boolean;
  mode: PlayMode;
  stickyDigit: number | null;
  pencilActive: boolean;
};

export function GameToolbar({
  formattedElapsed,
  mistakesCount,
  hintsCount,
  showMistakes,
  isPaused = false,
  mode,
  stickyDigit,
  pencilActive,
}: GameToolbarProps) {
  const [modeHint, setModeHint] = useState<ToolbarModeHint | null>(null);
  const shownHint = visibleToolbarModeHint(modeHint, stickyDigit, pencilActive);
  if (modeHint !== null && shownHint === null) {
    setModeHint(null);
  }

  useEffect(() => {
    if (shownHint === null) {
      return;
    }
    const timeoutId = window.setTimeout(() => setModeHint(null), TOOLBAR_MODE_HINT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [shownHint]);

  function toggleModeHint(nextHint: ToolbarModeHint) {
    setModeHint((current) => (current === nextHint ? null : nextHint));
  }

  if (mode.kind === "analysis") {
    return (
      <div className="gazette-toolbar">
        <span className="gazette-toolbar-analysis-by">
          {formatByNickname(mode.solverDisplayName)}
        </span>
      </div>
    );
  }

  return (
    <div className="gazette-toolbar">
      <div className="gazette-toolbar-row">
        <ToolbarModeSlot>
          {stickyDigit !== null && (
            <ToolbarModeButton
              label={`Sticky digit ${stickyDigit}`}
              expanded={shownHint === "sticky"}
              onToggle={() => toggleModeHint("sticky")}
            >
              <span className="gazette-toolbar-sticky-digit">{stickyDigit}</span>
            </ToolbarModeButton>
          )}
        </ToolbarModeSlot>
        <span className="gazette-toolbar-dot gazette-toolbar-dot-mode" aria-hidden="true">
          ·
        </span>
        {mode.kind === "solo" && (
          <LabeledMetric
            layout="inline"
            label="time"
            value={isPaused ? `${formattedElapsed} ‖` : formattedElapsed}
          />
        )}
        {showMistakes && (
          <>
            {mode.kind === "solo" && (
              <span className="gazette-toolbar-dot" aria-hidden="true">
                ·
              </span>
            )}
            <LabeledMetric layout="inline" label="mistakes" value={mistakesCount} />
          </>
        )}
        <span className="gazette-toolbar-dot" aria-hidden="true">
          ·
        </span>
        <LabeledMetric layout="inline" label="hints" value={hintsCount} />
        <span className="gazette-toolbar-dot gazette-toolbar-dot-mode" aria-hidden="true">
          ·
        </span>
        <ToolbarModeSlot>
          {pencilActive && (
            <ToolbarModeButton
              label="Pencil mode"
              expanded={shownHint === "pencil"}
              onToggle={() => toggleModeHint("pencil")}
            >
              <ToolbarPencilGlyph />
            </ToolbarModeButton>
          )}
        </ToolbarModeSlot>
      </div>
      {shownHint !== null && (
        <p
          id="gazette-toolbar-mode-hint"
          className="gazette-toolbar-mode-hint"
          role="status"
          aria-live="polite"
        >
          {toolbarModeHintText(shownHint, stickyDigit)}
        </p>
      )}
    </div>
  );
}

function visibleToolbarModeHint(
  modeHint: ToolbarModeHint | null,
  stickyDigit: number | null,
  pencilActive: boolean,
): ToolbarModeHint | null {
  if (modeHint === "sticky" && stickyDigit !== null) {
    return "sticky";
  }
  if (modeHint === "pencil" && pencilActive) {
    return "pencil";
  }
  return null;
}

function toolbarModeHintText(modeHint: ToolbarModeHint, stickyDigit: number | null): string {
  if (modeHint === "sticky") {
    if (stickyDigit === null) {
      throw new Error("stickyDigit required for sticky toolbar hint");
    }
    return `Sticky ${stickyDigit} – tap empty cells to place it.`;
  }
  return "Pencil – taps add notes, not digits.";
}

function stopToolbarHintPointer(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation();
}

function ToolbarModeSlot({ children }: { children?: ReactNode }) {
  return <span className="gazette-toolbar-mode-slot">{children}</span>;
}

function ToolbarModeButton({
  label,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="gazette-toolbar-mode-btn"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={expanded ? "gazette-toolbar-mode-hint" : undefined}
      onPointerDown={stopToolbarHintPointer}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}

function ToolbarPencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
    </svg>
  );
}
