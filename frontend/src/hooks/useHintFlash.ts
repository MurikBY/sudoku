import { useCallback, useEffect, useRef, useState } from "react";

const HINT_FLASH_DURATION_MS = 1000;
export const MOVE_PEER_NOTES_DELAY_MS = 300;

export function useHintFlash() {
  const [flashedCellIndices, setFlashedCellIndices] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const animationFrameRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  const triggerHintFlash = useCallback((cellOrCells: number | readonly number[]) => {
    const cells = (Array.isArray(cellOrCells) ? cellOrCells : [cellOrCells]).filter(
      (cell) => Number.isInteger(cell) && cell >= 0 && cell <= 80,
    );
    if (cells.length === 0) {
      return;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    setFlashedCellIndices(new Set());
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setFlashedCellIndices(new Set(cells));
      animationTimeoutRef.current = window.setTimeout(() => {
        setFlashedCellIndices(new Set());
        animationTimeoutRef.current = null;
      }, HINT_FLASH_DURATION_MS);
      animationFrameRef.current = null;
    });
  }, []);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (animationTimeoutRef.current !== null) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    },
    [],
  );

  return {
    hintedCellIndex: flashedCellIndices.size === 1 ? [...flashedCellIndices][0]! : null,
    flashedCellIndices,
    triggerHintFlash,
  };
}
