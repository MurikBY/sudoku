import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { CellNotesMap } from "@/api/types";
import { CellNotesMarks } from "@/components/CellNotesMarks";
import {
  GRID_SIDE,
  cellDigitValue,
  cellDisplayValue,
  isBoxBorderBottom,
  isBoxBorderRight,
  isGivenCell,
  noteDigitIndices,
  notesForCell,
  peerIndices,
  rowCol,
  sameDigitIndices,
} from "@/lib/play/sudokuGrid";
import { cn } from "@/lib/classNames";

const EMPTY_INDEX_SET: ReadonlySet<number> = new Set();
const EMPTY_NOTES: CellNotesMap = {};
const NO_HOUSES: readonly { kind: "row" | "col" | "box"; index: number }[] = [];

type SudokuGridProps = {
  puzzle: string;
  currentGrid: string;
  notes?: CellNotesMap;
  selectedIndex: number | null;
  stickyDigit?: number | null;
  conflictIndices?: ReadonlySet<number>;
  wrongDigitIndices?: ReadonlySet<number>;
  celebratingIndices?: ReadonlySet<number>;
  animatedMistakeIndex?: number | null;
  hintedCellIndex?: number | null;
  flashedCellIndices?: ReadonlySet<number>;
  coachOutlineIndices?: ReadonlySet<number>;
  coachElimIndices?: ReadonlySet<number>;
  coachHouses?: readonly { kind: "row" | "col" | "box"; index: number }[];
  pencilActive?: boolean;
  highlightPeers?: boolean;
  highlightSameDigit?: boolean;
  notePaintEnabled?: boolean;
  onSelectCell: (index: number) => void;
  onPaintCell?: (index: number) => void;
  onDigit?: (digit: number) => void;
  onClear?: () => void;
};

type NotePaintStroke = {
  pointerId: number;
  startIndex: number | null;
  painted: boolean;
  visited: Set<number>;
};

function CellPencilMark({ onLeft }: { onLeft: boolean }) {
  return (
    <span
      className={cn("sudoku-cell-pencil-mark", onLeft && "sudoku-cell-pencil-mark-left")}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20h9" strokeLinecap="round" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function cellIndexFromPoint(clientX: number, clientY: number): number | null {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!(hit instanceof Element)) {
    return null;
  }
  const cell = hit.closest("[data-cell-index]");
  if (!(cell instanceof HTMLElement)) {
    return null;
  }
  const rawIndex = cell.dataset.cellIndex;
  if (rawIndex === undefined) {
    return null;
  }
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0 || index > 80) {
    return null;
  }
  return index;
}

function cellAriaLabel(
  index: number,
  digitDisplay: string,
  isGiven: boolean,
  notes: readonly number[],
): string {
  const { row, col } = rowCol(index);
  const value = digitDisplay === "" ? "empty" : digitDisplay;
  const parts = [`Row ${row + 1}, column ${col + 1}`, value];
  if (isGiven) {
    parts.push("given");
  }
  if (notes.length > 0) {
    const ordered = [...notes].sort((left, right) => left - right);
    parts.push(`notes ${ordered.join(" ")}`);
  }
  return parts.join(", ");
}

function cellTabIndex(selectedIndex: number | null, index: number): 0 | -1 {
  return index === (selectedIndex ?? 0) ? 0 : -1;
}

function cellIndexAfterArrow(index: number, key: string): number | null {
  const { row, col } = rowCol(index);
  if (key === "ArrowLeft") {
    return col === 0 ? null : index - 1;
  }
  if (key === "ArrowRight") {
    return col === GRID_SIDE - 1 ? null : index + 1;
  }
  if (key === "ArrowUp") {
    return row === 0 ? null : index - GRID_SIDE;
  }
  if (key === "ArrowDown") {
    return row === GRID_SIDE - 1 ? null : index + GRID_SIDE;
  }
  return null;
}

function focusGridCell(cell: HTMLElement, index: number) {
  const grid = cell.parentElement;
  if (grid === null) {
    throw new Error("sudoku cell has no grid");
  }
  const next = grid.querySelector(`[data-cell-index="${index}"]`);
  if (!(next instanceof HTMLElement)) {
    throw new Error(`sudoku cell ${index} is not in the grid`);
  }
  next.focus({ preventScroll: true });
}

function applyCellKey(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  index: number,
  onSelectCell: (index: number) => void,
  onDigit: ((digit: number) => void) | undefined,
  onClear: (() => void) | undefined,
) {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (!event.repeat) {
      onSelectCell(index);
    }
    return;
  }
  if (
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight" ||
    event.key === "ArrowUp" ||
    event.key === "ArrowDown"
  ) {
    event.preventDefault();
    const nextIndex = cellIndexAfterArrow(index, event.key);
    if (nextIndex === null) {
      return;
    }
    onSelectCell(nextIndex);
    focusGridCell(event.currentTarget, nextIndex);
    return;
  }
  // Arrows keep repeating. A held digit or clear would fire again on every repeat.
  if (event.repeat) {
    return;
  }
  if (onDigit !== undefined && event.key.length === 1 && event.key >= "1" && event.key <= "9") {
    event.preventDefault();
    onDigit(Number(event.key));
    return;
  }
  if (onClear !== undefined && (event.key === "Backspace" || event.key === "Delete")) {
    event.preventDefault();
    onClear();
  }
}

export function SudokuGrid({
  puzzle,
  currentGrid,
  notes = EMPTY_NOTES,
  selectedIndex,
  stickyDigit = null,
  conflictIndices = EMPTY_INDEX_SET,
  wrongDigitIndices = EMPTY_INDEX_SET,
  celebratingIndices = EMPTY_INDEX_SET,
  animatedMistakeIndex = null,
  hintedCellIndex = null,
  flashedCellIndices,
  coachOutlineIndices = EMPTY_INDEX_SET,
  coachElimIndices = EMPTY_INDEX_SET,
  coachHouses = NO_HOUSES,
  pencilActive = false,
  highlightPeers = true,
  highlightSameDigit = true,
  notePaintEnabled = false,
  onSelectCell,
  onPaintCell,
  onDigit,
  onClear,
}: SudokuGridProps) {
  const notePaintStrokeRef = useRef<NotePaintStroke | null>(null);
  const peerHighlightIndices =
    !highlightPeers || selectedIndex === null
      ? new Set<number>()
      : new Set(peerIndices(selectedIndex));

  const selectedDigit = selectedIndex === null ? null : cellDigitValue(currentGrid, selectedIndex);
  const focusDigit = stickyDigit ?? selectedDigit;
  const sameDigitHighlightIndices =
    !highlightSameDigit || focusDigit === null
      ? new Set<number>()
      : new Set(sameDigitIndices(currentGrid, focusDigit));
  const sameNoteHighlightIndices =
    !highlightSameDigit || focusDigit === null
      ? new Set<number>()
      : new Set(noteDigitIndices(notes, currentGrid, focusDigit));

  const paintCell = (index: number) => {
    if (!onPaintCell) {
      throw new Error("onPaintCell required when note paint is enabled");
    }
    onPaintCell(index);
  };

  const endNotePaintStroke = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stroke = notePaintStrokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) {
      return;
    }
    notePaintStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!stroke.painted && stroke.startIndex !== null) {
      onSelectCell(stroke.startIndex);
    }
  };

  return (
    <div
      className={cn(
        "sudoku-grid-frame",
        pencilActive && "sudoku-grid-frame-pencil-mode",
        notePaintEnabled && "sudoku-grid-frame-note-paint",
      )}
    >
      <div
        className="sudoku-grid"
        role="group"
        aria-label="Sudoku board"
        onPointerDown={(event) => {
          if (!notePaintEnabled) {
            return;
          }
          if (!event.isPrimary) {
            return;
          }
          if (event.pointerType === "mouse" && event.button !== 0) {
            return;
          }
          const index = cellIndexFromPoint(event.clientX, event.clientY);
          notePaintStrokeRef.current = {
            pointerId: event.pointerId,
            startIndex: index,
            painted: false,
            visited: index === null ? new Set() : new Set([index]),
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const stroke = notePaintStrokeRef.current;
          if (stroke === null || stroke.pointerId !== event.pointerId) {
            return;
          }
          const index = cellIndexFromPoint(event.clientX, event.clientY);
          if (index === null || stroke.visited.has(index)) {
            return;
          }
          stroke.visited.add(index);
          if (!stroke.painted) {
            stroke.painted = true;
            if (stroke.startIndex !== null) {
              paintCell(stroke.startIndex);
            }
          }
          if (index !== stroke.startIndex) {
            paintCell(index);
          }
        }}
        onPointerUp={(event) => {
          if (notePaintEnabled) {
            endNotePaintStroke(event);
            return;
          }
          if (event.button !== 0) {
            return;
          }
          const index = cellIndexFromPoint(event.clientX, event.clientY);
          if (index === null) {
            return;
          }
          onSelectCell(index);
        }}
        onPointerCancel={(event) => {
          if (!notePaintEnabled) {
            return;
          }
          notePaintStrokeRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        {Array.from({ length: 81 }, (_, index) => {
          const { row, col } = rowCol(index);
          const isGiven = isGivenCell(puzzle, index);
          const isSelected = selectedIndex === index;
          const isPeer = peerHighlightIndices.has(index);
          const isSameDigit = sameDigitHighlightIndices.has(index);
          const isSameNote = sameNoteHighlightIndices.has(index);
          const isConflict = conflictIndices.has(index);
          const isWrong = wrongDigitIndices.has(index);
          const isCelebrating = celebratingIndices.has(index);
          const isAnimatedMistake = animatedMistakeIndex === index;
          const isHintFlash =
            hintedCellIndex === index || (flashedCellIndices?.has(index) ?? false);
          const isCoachOutline = coachOutlineIndices.has(index);
          const isCoachElim = !isCoachOutline && coachElimIndices.has(index);
          const showPencilMark = pencilActive && isSelected && !isGiven;
          const cellNotes = notesForCell(notes, index);
          const digitDisplay = cellDisplayValue(currentGrid, index);
          const showNotes = digitDisplay === "" && cellNotes.length > 0;

          return (
            <button
              key={index}
              type="button"
              data-cell-index={index}
              tabIndex={cellTabIndex(selectedIndex, index)}
              aria-label={cellAriaLabel(index, digitDisplay, isGiven, cellNotes)}
              aria-pressed={isSelected}
              onClick={(event) => {
                // Pointer input selects on pointerup. detail 0 is a keyboard or assistive click.
                if (event.detail !== 0) {
                  return;
                }
                onSelectCell(index);
              }}
              onKeyDown={(event) => {
                applyCellKey(event, index, onSelectCell, onDigit, onClear);
              }}
              className={cn(
                "sudoku-grid-cell",
                isGiven ? "sudoku-grid-cell-given" : "sudoku-grid-cell-editable",
                isPeer && !isSameDigit && !isSameNote && !isSelected && "sudoku-grid-cell-peer",
                isSameDigit && !isSelected && "sudoku-grid-cell-same-digit",
                isSameNote && !isSameDigit && !isSelected && "sudoku-grid-cell-same-note",
                isConflict && "sudoku-grid-cell-conflict",
                isWrong && "sudoku-grid-cell-wrong",
                isSelected && "sudoku-grid-cell-selected",
                isCelebrating && "sudoku-grid-cell-unit-complete",
                isAnimatedMistake && "sudoku-grid-cell-mistake-pulse",
                isHintFlash && "sudoku-grid-cell-hint-flash",
                isCoachOutline && "sudoku-grid-cell-coach-outline",
                isCoachElim && "sudoku-grid-cell-coach-elim",
                showPencilMark && "sudoku-grid-cell-pencil-host",
                isBoxBorderRight(col) && "sudoku-grid-cell-box-border-r",
                isBoxBorderBottom(row) && "sudoku-grid-cell-box-border-b",
              )}
            >
              {showNotes ? (
                <CellNotesMarks digits={cellNotes} accentDigit={focusDigit} />
              ) : (
                digitDisplay
              )}
              {showPencilMark && <CellPencilMark onLeft={col >= 8} />}
            </button>
          );
        })}
        {coachHouses.map((house) => (
          <div
            key={`${house.kind}-${house.index}`}
            className="sudoku-grid-coach-house-ring"
            style={coachHouseRingStyle(house)}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

function coachHouseRingStyle(house: { kind: "row" | "col" | "box"; index: number }): {
  top: string;
  left: string;
  width: string;
  height: string;
} {
  const cell = 100 / 9;
  if (house.kind === "row") {
    return {
      top: `${house.index * cell}%`,
      left: "0%",
      width: "100%",
      height: `${cell}%`,
    };
  }
  if (house.kind === "col") {
    return {
      top: "0%",
      left: `${house.index * cell}%`,
      width: `${cell}%`,
      height: "100%",
    };
  }
  const bandRow = Math.floor(house.index / 3);
  const bandCol = house.index % 3;
  return {
    top: `${bandRow * 3 * cell}%`,
    left: `${bandCol * 3 * cell}%`,
    width: `${3 * cell}%`,
    height: `${3 * cell}%`,
  };
}
