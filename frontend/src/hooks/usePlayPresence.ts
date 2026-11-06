import { useEffect, useRef } from "react";

import type { ScreenState } from "@/hooks/screenState";
import type { PlayLockAttempt } from "@/hooks/usePlayLock";

const HOME_LOCK_POLL_MS = 2500;
const PLAY_LOCK_POLL_MS = 8000;

function reportConflict(attempt: PlayLockAttempt, onLockConflict: () => void) {
  if (attempt === "conflict") {
    onLockConflict();
  }
}

type UsePlayPresenceArgs = {
  screenName: ScreenState["name"];
  lobbyOpen: boolean;
  ensurePlayLock: () => Promise<PlayLockAttempt>;
  refreshForeignPlayLock: () => Promise<void>;
  onLockConflict: () => void;
};

export function usePlayPresence({
  screenName,
  lobbyOpen,
  ensurePlayLock,
  refreshForeignPlayLock,
  onLockConflict,
}: UsePlayPresenceArgs) {
  const onLockConflictRef = useRef(onLockConflict);

  useEffect(() => {
    onLockConflictRef.current = onLockConflict;
  }, [onLockConflict]);

  useEffect(() => {
    if (screenName !== "home" || lobbyOpen) {
      return undefined;
    }
    void refreshForeignPlayLock();
    const intervalId = window.setInterval(() => {
      void refreshForeignPlayLock();
    }, HOME_LOCK_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [lobbyOpen, refreshForeignPlayLock, screenName]);

  useEffect(() => {
    if (screenName !== "play" && !lobbyOpen) {
      return undefined;
    }
    let current = true;
    const watchLock = () => {
      void ensurePlayLock().then((attempt) => {
        if (!current) {
          return;
        }
        reportConflict(attempt, onLockConflictRef.current);
      });
    };
    watchLock();
    const intervalId = window.setInterval(watchLock, PLAY_LOCK_POLL_MS);
    return () => {
      current = false;
      window.clearInterval(intervalId);
    };
  }, [ensurePlayLock, lobbyOpen, screenName]);

  // Do not release on visibility hidden – that let the other device steal the lock.
  useEffect(() => {
    let current = true;
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (screenName === "play" || lobbyOpen) {
        void ensurePlayLock().then((attempt) => {
          if (!current) {
            return;
          }
          reportConflict(attempt, onLockConflictRef.current);
        });
        return;
      }
      if (screenName === "home") {
        void refreshForeignPlayLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ensurePlayLock, lobbyOpen, refreshForeignPlayLock, screenName]);
}
