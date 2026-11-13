import { useEffect, useRef, type RefObject } from "react";

import type { Game } from "@/api/types";
import type { ScreenState } from "@/hooks/screenState";

// Async leave handlers read the game on screen when they run, not when they were created.
export function useActiveGameRef(screen: ScreenState): RefObject<Game | null> {
  const activeGameRef = useRef<Game | null>(null);
  useEffect(() => {
    activeGameRef.current = screen.name === "play" ? screen.game : null;
  }, [screen]);
  return activeGameRef;
}
