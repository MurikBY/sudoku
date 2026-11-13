import { useEffect, useRef } from "react";

import type { Game } from "@/api/types";

// Queued board actions run later than they were created, so they read the game and selection here.
export function useLatestBoardRefs(game: Game, selectedIndex: number | null) {
  const gameRef = useRef(game);
  const selectedIndexRef = useRef(selectedIndex);
  useEffect(() => {
    gameRef.current = game;
    selectedIndexRef.current = selectedIndex;
  }, [game, selectedIndex]);
  return { gameRef, selectedIndexRef };
}
