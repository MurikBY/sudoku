import type { ReactNode } from "react";

import type { GuideAssistPreviewId } from "@/content/infoGuideCopy";
import { cn } from "@/lib/classNames";

type GuideAssistPreviewProps = {
  previewId: GuideAssistPreviewId;
};

const GRID_CELLS = 9;

function MiniGrid({
  className,
  cellClassName,
  cellContent,
}: {
  className?: string;
  cellClassName: (index: number) => string | false | undefined;
  cellContent?: (index: number) => ReactNode;
}) {
  return (
    <div className={cn("guide-preview-grid", className)} aria-hidden="true">
      {Array.from({ length: GRID_CELLS }, (_, index) => (
        <span key={index} className={cn("guide-preview-cell", cellClassName(index))}>
          {cellContent?.(index)}
        </span>
      ))}
    </div>
  );
}

function MiniPad({ dimDigit, stickyDigit }: { dimDigit?: number; stickyDigit?: number }) {
  return (
    <div className="guide-preview-pad" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((digit) => (
        <span
          key={digit}
          className={cn(
            "guide-preview-pad-key",
            dimDigit === digit && "guide-preview-pad-key-dim",
            stickyDigit === digit && "guide-preview-pad-key-sticky",
          )}
        >
          {digit}
        </span>
      ))}
    </div>
  );
}

function PencilNotes({ digits, goneDigits = [] }: { digits: number[]; goneDigits?: number[] }) {
  return (
    <span className="guide-preview-cell-notes">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => {
        const isGone = goneDigits.includes(digit);
        const isVisible = digits.includes(digit) || isGone;
        return (
          <span
            key={digit}
            className={cn("guide-preview-cell-note", isGone && "guide-preview-cell-note-gone")}
          >
            {isVisible ? digit : ""}
          </span>
        );
      })}
    </span>
  );
}

function NotesPencilMark() {
  return (
    <span className="guide-preview-notes-pencil">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20h9" strokeLinecap="round" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function GuideAssistPreview({ previewId }: GuideAssistPreviewProps) {
  if (previewId === "highlightPeers") {
    return (
      <MiniGrid
        cellClassName={(index) => {
          if (index === 4) {
            return "guide-preview-cell-selected";
          }
          if ([1, 3, 5, 7].includes(index)) {
            return "guide-preview-cell-peer";
          }
          return undefined;
        }}
      />
    );
  }

  if (previewId === "highlightSameDigit") {
    const digits: (string | null)[] = ["5", "2", null, "8", "5", "1", "3", "9", "5"];
    return (
      <MiniGrid
        cellClassName={(index) => {
          if (index === 4) {
            return "guide-preview-cell-selected guide-preview-cell-same";
          }
          if (index === 0 || index === 8) {
            return "guide-preview-cell-same";
          }
          if (index === 2) {
            return "guide-preview-cell-same-note";
          }
          return undefined;
        }}
        cellContent={(index) => {
          if (index === 2) {
            return <PencilNotes digits={[5, 7]} />;
          }
          const digit = digits[index];
          if (digit == null) {
            return null;
          }
          return <span className="guide-preview-cell-digit">{digit}</span>;
        }}
      />
    );
  }

  if (previewId === "mistakeFeedback") {
    const digits: (string | null)[] = ["7", null, "1", null, "7", "2", "3", null, null];
    return (
      <MiniGrid
        cellClassName={(index) => {
          if (index === 4) {
            return "guide-preview-cell-wrong";
          }
          return undefined;
        }}
        cellContent={(index) => {
          const digit = digits[index];
          if (digit == null) {
            return null;
          }
          return (
            <span
              className={cn(
                "guide-preview-cell-digit",
                index === 4 && "guide-preview-cell-digit-wrong",
              )}
            >
              {digit}
            </span>
          );
        }}
      />
    );
  }

  if (previewId === "dimCompletedDigits") {
    return <MiniPad dimDigit={3} />;
  }

  if (previewId === "unitCompleteAnimation") {
    return (
      <MiniGrid
        className="guide-preview-grid-flash"
        cellClassName={(index) => {
          if (index < 3) {
            return "guide-preview-cell-flash";
          }
          return undefined;
        }}
        cellContent={(index) => {
          if (index > 2) {
            return null;
          }
          return <span className="guide-preview-cell-digit">{String(index + 1)}</span>;
        }}
      />
    );
  }

  if (previewId === "autoClearNotes") {
    return (
      <div className="guide-preview-notes" aria-hidden="true">
        <span className="guide-preview-notes-cell">
          <PencilNotes digits={[5, 7]} goneDigits={[2]} />
          <NotesPencilMark />
        </span>
        <span className="guide-preview-notes-arrow">→</span>
        <span className="guide-preview-notes-cell">
          <PencilNotes digits={[5, 7]} />
          <NotesPencilMark />
        </span>
      </div>
    );
  }

  return <MiniPad stickyDigit={4} />;
}
