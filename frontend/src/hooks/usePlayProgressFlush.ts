import { useEffect, useRef } from "react";

import { syncGameProgress } from "@/api/games";
import type { Game } from "@/api/types";

type UsePlayProgressFlushArgs = {
  gameId: string;
  gameStatus: Game["status"];
  isPaused: boolean;
  getElapsedSeconds: () => number;
};

// Saves the elapsed time when play pauses and when Play unmounts, so a closed app keeps it.
export function usePlayProgressFlush({
  gameId,
  gameStatus,
  isPaused,
  getElapsedSeconds,
}: UsePlayProgressFlushArgs) {
  const wasPausedRef = useRef(isPaused);

  useEffect(() => {
    const becamePaused = isPaused && !wasPausedRef.current;
    wasPausedRef.current = isPaused;
    if (!becamePaused || gameStatus !== "in_progress") {
      return;
    }
    void syncGameProgress(gameId, getElapsedSeconds()).catch(() => {
      // best-effort flush when pausing
    });
  }, [isPaused, gameId, gameStatus, getElapsedSeconds]);

  useEffect(() => {
    return () => {
      if (gameStatus !== "in_progress") {
        return;
      }
      void syncGameProgress(gameId, getElapsedSeconds()).catch(() => {
        // best-effort flush when leaving Play
      });
    };
  }, [gameId, gameStatus, getElapsedSeconds]);
}
