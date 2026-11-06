import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { completedPadDigits } from "@/lib/play/boardView";
import { cellDigitValue, isGivenCell } from "@/lib/play/sudokuGrid";
import { signalStickyDigitHaptic } from "@/lib/telegram/signalStickyDigitHaptic";

type StickyBoard = {
  puzzle: string;
  currentGrid: string;
  conflictIndices: ReadonlySet<number>;
  wrongDigitIndices: ReadonlySet<number>;
  dimCompletedDigits: boolean;
};

type UseStickyDigitArgs = {
  isPlaying: boolean;
  stickyAssist: boolean;
  board: StickyBoard;
  addNote: (digit: number, elapsedSeconds: number, cellIndex: number) => Promise<unknown>;
  getElapsedSeconds: () => number;
  prepareGesture: () => void;
  selectCell: (index: number | null) => void;
};

export function useStickyDigit({
  isPlaying,
  stickyAssist,
  board,
  addNote,
  getElapsedSeconds,
  prepareGesture,
  selectCell,
}: UseStickyDigitArgs): {
  stickyDigit: number | null;
  digitRef: RefObject<number | null>;
  clearStickyDigit: () => void;
  handleStickyDigit: (digit: number) => void;
  handlePaintNoteCell: (index: number) => void;
} {
  const { puzzle, currentGrid, conflictIndices, wrongDigitIndices, dimCompletedDigits } = board;
  const [stickyDigit, setStickyDigit] = useState<number | null>(null);
  const digitRef = useRef<number | null>(stickyDigit);
  const puzzleRef = useRef(puzzle);
  const currentGridRef = useRef(currentGrid);
  const padCompletedDigits = completedPadDigits(
    currentGrid,
    conflictIndices,
    wrongDigitIndices,
    dimCompletedDigits,
  );
  // Drop during render so the committed frame does not keep a digit play can no longer use.
  if (
    stickyDigit !== null &&
    (!isPlaying || !stickyAssist || padCompletedDigits.has(stickyDigit))
  ) {
    setStickyDigit(null);
  }

  useEffect(() => {
    digitRef.current = stickyDigit;
    puzzleRef.current = puzzle;
    currentGridRef.current = currentGrid;
  }, [currentGrid, puzzle, stickyDigit]);

  const clearStickyDigit = useCallback(() => {
    setStickyDigit(null);
  }, []);

  function handleStickyDigit(digit: number) {
    if (!stickyAssist) {
      return;
    }
    prepareGesture();
    setStickyDigit(digit);
    selectCell(null);
    signalStickyDigitHaptic();
  }

  function handlePaintNoteCell(index: number) {
    prepareGesture();
    const lockedDigit = digitRef.current;
    if (lockedDigit === null) {
      return;
    }
    if (isGivenCell(puzzleRef.current, index)) {
      return;
    }
    if (cellDigitValue(currentGridRef.current, index) !== null) {
      return;
    }
    void addNote(lockedDigit, getElapsedSeconds(), index);
  }

  return {
    stickyDigit,
    digitRef,
    clearStickyDigit,
    handleStickyDigit,
    handlePaintNoteCell,
  };
}
