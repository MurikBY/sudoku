import { type KeyboardEvent as ReactKeyboardEvent } from "react";

import { CellNotesMarks } from "@/components/CellNotesMarks";
import { GRID_SIDE, isBoxBorderBottom, isBoxBorderRight, rowCol } from "@/lib/play/sudokuGrid";
import { cn } from "@/lib/classNames";

export type CellState = {
  isGiven: boolean;
  isSelected: boolean;
  isPeer: boolean;
  isSameDigit: boolean;
  isSameNote: boolean;
  isConflict: boolean;
  isWrong: boolean;
  isCelebrating: boolean;
  isAnimatedMistake: boolean;
  isHintFlash: boolean;
  isCoachOutline: boolean;
  isCoachElim: boolean;
  showPencilMark: boolean;
  notes: number[];
  digitDisplay: string;
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

function cellClassName(state: CellState, row: number, col: number): string {
  const { isSelected, isSameDigit, isSameNote } = state;
  return cn(
    "sudoku-grid-cell",
    state.isGiven ? "sudoku-grid-cell-given" : "sudoku-grid-cell-editable",
    state.isPeer && !isSameDigit && !isSameNote && !isSelected && "sudoku-grid-cell-peer",
    isSameDigit && !isSelected && "sudoku-grid-cell-same-digit",
    isSameNote && !isSameDigit && !isSelected && "sudoku-grid-cell-same-note",
    state.isConflict && "sudoku-grid-cell-conflict",
    state.isWrong && "sudoku-grid-cell-wrong",
    isSelected && "sudoku-grid-cell-selected",
    state.isCelebrating && "sudoku-grid-cell-unit-complete",
    state.isAnimatedMistake && "sudoku-grid-cell-mistake-pulse",
    state.isHintFlash && "sudoku-grid-cell-hint-flash",
    state.isCoachOutline && "sudoku-grid-cell-coach-outline",
    state.isCoachElim && "sudoku-grid-cell-coach-elim",
    state.showPencilMark && "sudoku-grid-cell-pencil-host",
    isBoxBorderRight(col) && "sudoku-grid-cell-box-border-r",
    isBoxBorderBottom(row) && "sudoku-grid-cell-box-border-b",
  );
}

type SudokuGridCellProps = {
  index: number;
  state: CellState;
  selectedIndex: number | null;
  focusDigit: number | null;
  onSelectCell: (index: number) => void;
  onDigit?: (digit: number) => void;
  onClear?: () => void;
};

export function SudokuGridCell({
  index,
  state,
  selectedIndex,
  focusDigit,
  onSelectCell,
  onDigit,
  onClear,
}: SudokuGridCellProps) {
  const { row, col } = rowCol(index);
  const showNotes = state.digitDisplay === "" && state.notes.length > 0;
  return (
    <button
      type="button"
      data-cell-index={index}
      tabIndex={cellTabIndex(selectedIndex, index)}
      aria-label={cellAriaLabel(index, state.digitDisplay, state.isGiven, state.notes)}
      aria-pressed={state.isSelected}
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
      className={cellClassName(state, row, col)}
    >
      {showNotes ? (
        <CellNotesMarks digits={state.notes} accentDigit={focusDigit} />
      ) : (
        state.digitDisplay
      )}
      {state.showPencilMark && <CellPencilMark onLeft={col >= 8} />}
    </button>
  );
}
