import { useCallback, useEffect, useRef } from "react";

import { acquirePlayLock, heartbeatPlayLock, releasePlayLock } from "@/api/playLock";
import { ApiError } from "@/lib/api/apiError";
import { bestEffort } from "@/lib/api/bestEffort";
import { getOrCreatePlayLockToken } from "@/lib/play/playLockToken";

const HEARTBEAT_INTERVAL_MS = 4000;

export type PlayLockAttempt = "acquired" | "conflict" | "failed";

type UsePlayLockArgs = {
  onLostLock?: () => void;
};

export function usePlayLock({ onLostLock }: UsePlayLockArgs = {}) {
  const holdingRef = useRef(false);
  const heartbeatIdRef = useRef<number | null>(null);
  const heartbeatGenerationRef = useRef(0);
  const onLostLockRef = useRef(onLostLock);

  useEffect(() => {
    onLostLockRef.current = onLostLock;
  }, [onLostLock]);

  const stopHeartbeat = useCallback(() => {
    heartbeatGenerationRef.current += 1;
    if (heartbeatIdRef.current !== null) {
      window.clearInterval(heartbeatIdRef.current);
      heartbeatIdRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    const generation = heartbeatGenerationRef.current;
    const token = getOrCreatePlayLockToken();
    const pulse = () => {
      void heartbeatPlayLock(token)
        .then(() => {
          if (heartbeatGenerationRef.current !== generation) {
            return;
          }
          holdingRef.current = true;
        })
        .catch((error) => {
          if (heartbeatGenerationRef.current !== generation) {
            return;
          }
          if (error instanceof ApiError && error.kind === "conflict") {
            holdingRef.current = false;
            stopHeartbeat();
            onLostLockRef.current?.();
          }
        });
    };
    pulse();
    heartbeatIdRef.current = window.setInterval(pulse, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

  const release = useCallback(async () => {
    stopHeartbeat();
    holdingRef.current = false;
    const token = getOrCreatePlayLockToken();
    await bestEffort("play lock release; TTL clears stale locks", () => releasePlayLock(token));
  }, [stopHeartbeat]);

  const acquire = useCallback(async (): Promise<boolean> => {
    const token = getOrCreatePlayLockToken();
    try {
      await acquirePlayLock(token);
      holdingRef.current = true;
      startHeartbeat();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.kind === "conflict") {
        holdingRef.current = false;
        stopHeartbeat();
        return false;
      }
      throw error;
    }
  }, [startHeartbeat, stopHeartbeat]);

  // Do NOT release on unmount – StrictMode/HMR would drop the lock while Play is open.
  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  return { acquire, release };
}
