import { useEffect } from "react";

import type { PartyLobbyPhase } from "@/hooks/partyLobbyState";
import type { ScreenState } from "@/hooks/screenState";
import type { LockConflictHandler } from "@/hooks/usePlayLockGate";

function lockConflictAction(
  screenName: ScreenState["name"],
  lobbyOpen: boolean,
  phase: PartyLobbyPhase,
): "goHome" | "leave" | "close" | "stay" {
  if (screenName === "play") {
    return "goHome";
  }
  if (!lobbyOpen) {
    return "stay";
  }
  if (phase === "host" || phase === "guest") {
    return "leave";
  }
  if (phase === "chooser") {
    return "close";
  }
  return "stay";
}

type UseLockConflictRoutingArgs = {
  screenName: ScreenState["name"];
  lobbyOpen: boolean;
  lobbyPhase: PartyLobbyPhase;
  goHome: () => void;
  leaveLobby: () => Promise<void>;
  closeLobby: () => void;
  setLockConflictHandler: (handler: LockConflictHandler) => void;
};

// When another device takes the play lock, Play goes home and an open lobby is left or closed.
export function useLockConflictRouting({
  screenName,
  lobbyOpen,
  lobbyPhase,
  goHome,
  leaveLobby,
  closeLobby,
  setLockConflictHandler,
}: UseLockConflictRoutingArgs) {
  useEffect(() => {
    setLockConflictHandler(() => {
      const action = lockConflictAction(screenName, lobbyOpen, lobbyPhase);
      if (action === "stay") {
        return null;
      }
      if (action === "goHome") {
        return goHome;
      }
      if (action === "leave") {
        return () => {
          void leaveLobby();
        };
      }
      return closeLobby;
    });
  }, [closeLobby, goHome, leaveLobby, lobbyOpen, lobbyPhase, screenName, setLockConflictHandler]);
}
