import { useEffect, useRef } from "react";

// Input handlers run after awaits and sticky-digit taps, so they read the latest board here.
export function useLatestBoardCells(puzzle: string, currentGrid: string, isPencilMode: boolean) {
  const puzzleRef = useRef(puzzle);
  const currentGridRef = useRef(currentGrid);
  const pencilModeRef = useRef(isPencilMode);

  useEffect(() => {
    puzzleRef.current = puzzle;
    currentGridRef.current = currentGrid;
    pencilModeRef.current = isPencilMode;
  }, [currentGrid, isPencilMode, puzzle]);

  return { puzzleRef, currentGridRef, pencilModeRef };
}
