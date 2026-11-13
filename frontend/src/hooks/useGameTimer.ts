import { useCallback, useEffect, useRef, useState } from "react";

import { syncGameProgress } from "@/api/games";
import { bestEffort } from "@/lib/api/bestEffort";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";

const HEARTBEAT_INTERVAL_MS = 10_000;
const TICK_INTERVAL_MS = 1000;

export type UseGameTimerParams = {
  gameId: string | null;
  initialElapsedSeconds: number;
  isRunning: boolean;
};

export function useGameTimer({ gameId, initialElapsedSeconds, isRunning }: UseGameTimerParams) {
  const [elapsedSeconds, setElapsedSeconds] = useState(initialElapsedSeconds);
  const elapsedSecondsRef = useRef(elapsedSeconds);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const previousGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (gameId !== previousGameIdRef.current) {
      previousGameIdRef.current = gameId;
      setElapsedSeconds(initialElapsedSeconds);
    }
  }, [gameId, initialElapsedSeconds]);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const tickId = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(tickId);
  }, [isRunning]);

  const syncElapsedToServer = useCallback(async () => {
    if (!gameId) {
      return;
    }
    await bestEffort("elapsed heartbeat; next interval retries", () =>
      syncGameProgress(gameId, elapsedSecondsRef.current),
    );
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !isRunning) {
      return undefined;
    }

    const heartbeatId = window.setInterval(() => {
      void syncElapsedToServer();
    }, HEARTBEAT_INTERVAL_MS);
    // The interval can leave 10 seconds unsent, so hiding or closing the page sends them.
    const syncWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        void syncElapsedToServer();
      }
    };
    const syncOnPageHide = () => {
      void syncElapsedToServer();
    };
    document.addEventListener("visibilitychange", syncWhenHidden);
    window.addEventListener("pagehide", syncOnPageHide);

    return () => {
      window.clearInterval(heartbeatId);
      document.removeEventListener("visibilitychange", syncWhenHidden);
      window.removeEventListener("pagehide", syncOnPageHide);
    };
  }, [gameId, isRunning, syncElapsedToServer]);

  const setElapsedFromServer = useCallback((seconds: number) => {
    setElapsedSeconds(seconds);
  }, []);

  const getElapsedSeconds = useCallback(() => elapsedSecondsRef.current, []);

  return {
    elapsedSeconds,
    formattedElapsed: formatElapsedSeconds(elapsedSeconds),
    setElapsedFromServer,
    getElapsedSeconds,
  };
}
