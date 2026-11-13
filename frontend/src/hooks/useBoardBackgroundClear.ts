import type { PointerEvent as ReactPointerEvent } from "react";

type BoardPointerEvent = ReactPointerEvent<HTMLDivElement>;

type UseBoardBackgroundClearArgs = {
  selectedIndex: number | null;
  selectCell: (index: number | null) => void;
  dismissCoachCard: () => void;
};

// A primary press on the board background closes the coach card and clears the selection.
// The grid, pad, and actions stop the press so it never reaches the background.
export function useBoardBackgroundClear({
  selectedIndex,
  selectCell,
  dismissCoachCard,
}: UseBoardBackgroundClearArgs) {
  function handleBoardBackgroundPointerDown(event: BoardPointerEvent) {
    if (!event.isPrimary) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    dismissCoachCard();
    if (selectedIndex !== null) {
      selectCell(null);
    }
  }

  function stopBoardClearPropagation(event: BoardPointerEvent) {
    event.stopPropagation();
  }

  return { handleBoardBackgroundPointerDown, stopBoardClearPropagation };
}
