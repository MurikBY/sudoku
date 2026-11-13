import { useCallback, useRef, useState } from "react";

import { fetchPlayLockStatus } from "@/api/playLock";
import { usePlayLock, type PlayLockAttempt } from "@/hooks/usePlayLock";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { bestEffort } from "@/lib/api/bestEffort";

// Returns what to do about a lost lock, or null to stay on the current screen.
export type LockConflictHandler = () => (() => void) | null;

type UsePlayLockGateArgs = {
  onError: (message: string) => void;
};

export function usePlayLockGate({ onError }: UsePlayLockGateArgs) {
  const conflictHandlerRef = useRef<LockConflictHandler>(() => null);
  // Stays set until the next acquire, so a second watcher does not call leaveParty again.
  const conflictHandledRef = useRef(false);
  const [playLockedByOther, setPlayLockedByOther] = useState(false);

  const reportLockConflict = useCallback(() => {
    if (conflictHandledRef.current) {
      return;
    }
    const resolveConflict = conflictHandlerRef.current();
    if (resolveConflict === null) {
      return;
    }
    conflictHandledRef.current = true;
    resolveConflict();
  }, []);

  const setLockConflictHandler = useCallback((handler: LockConflictHandler) => {
    conflictHandlerRef.current = handler;
  }, []);

  const { acquire, release: releasePlayLock } = usePlayLock({ onLostLock: reportLockConflict });

  const acquirePlayLock = useCallback(async () => {
    const acquired = await acquire();
    if (acquired) {
      conflictHandledRef.current = false;
    }
    return acquired;
  }, [acquire]);

  const ensurePlayLock = useCallback(async (): Promise<PlayLockAttempt> => {
    try {
      const acquired = await acquirePlayLock();
      if (!acquired) {
        setPlayLockedByOther(true);
        return "conflict";
      }
      setPlayLockedByOther(false);
      return "acquired";
    } catch (error) {
      onError(formatApiErrorMessage(error));
      return "failed";
    }
  }, [acquirePlayLock, onError]);

  const playLockIsHeld = useCallback(async () => {
    return (await ensurePlayLock()) === "acquired";
  }, [ensurePlayLock]);

  const refreshForeignPlayLock = useCallback(async () => {
    await bestEffort("keep last known lock UI; click path still enforces", async () => {
      const status = await fetchPlayLockStatus();
      setPlayLockedByOther(status.locked && !status.is_holder);
    });
  }, []);

  return {
    playLockedByOther,
    acquirePlayLock,
    releasePlayLock,
    ensurePlayLock,
    playLockIsHeld,
    refreshForeignPlayLock,
    reportLockConflict,
    setLockConflictHandler,
  };
}
