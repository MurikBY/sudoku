import { useCallback } from "react";

import type { ScreenState } from "@/hooks/screenState";
import type { PlaySessionLobby } from "@/hooks/playSessionTypes";
import { usePartyLobby } from "@/hooks/usePartyLobby";

type UsePlaySessionLobbyArgs = Parameters<typeof usePartyLobby>[0] & {
  screenName: ScreenState["name"];
  releasePlayLock: () => Promise<void>;
  playLockIsHeld: () => Promise<boolean>;
};

// The lobby holds the play lock only while it is the screen in front, not over a running board.
export function usePlaySessionLobby({
  screenName,
  releasePlayLock,
  playLockIsHeld,
  ...partyLobbyArgs
}: UsePlaySessionLobbyArgs) {
  const partyLobby = usePartyLobby(partyLobbyArgs);
  const { closeLobby, handleLeave, dismissClosedLobby, openLobby } = partyLobby;

  const handleCloseLobby = useCallback(() => {
    closeLobby();
    if (screenName !== "play") {
      void releasePlayLock();
    }
  }, [closeLobby, releasePlayLock, screenName]);

  const handleLeaveLobby = useCallback(async () => {
    await handleLeave();
    if (screenName !== "play") {
      void releasePlayLock();
    }
  }, [handleLeave, releasePlayLock, screenName]);

  const handleDismissClosedLobby = useCallback(() => {
    dismissClosedLobby();
    void releasePlayLock();
  }, [dismissClosedLobby, releasePlayLock]);

  const handlePlayWithFriends = useCallback(async () => {
    if (!(await playLockIsHeld())) {
      return;
    }
    openLobby();
  }, [openLobby, playLockIsHeld]);

  const lobby: PlaySessionLobby = {
    open: partyLobby.open,
    phase: partyLobby.phase,
    party: partyLobby.party,
    members: partyLobby.members,
    joinCode: partyLobby.joinCode,
    joinedOk: partyLobby.joinedOk,
    busy: partyLobby.busy,
    error: partyLobby.error,
    onDifficultyChange: (level) => {
      void partyLobby.handleDifficultyChange(level);
    },
    onJoinCodeChange: partyLobby.setJoinCode,
    onChooseJoin: partyLobby.chooseJoin,
    onCreate: () => {
      void partyLobby.handleCreate();
    },
    onJoin: () => {
      void partyLobby.handleJoin();
    },
    onStart: () => {
      void partyLobby.handleStart();
    },
    onLeave: () => {
      void handleLeaveLobby();
    },
    onClose: handleCloseLobby,
    onDismissClosed: handleDismissClosedLobby,
    onClearError: partyLobby.clearError,
  };

  return {
    lobby,
    openLobbyWithInviteCode: partyLobby.openLobbyWithInviteCode,
    handleCloseLobby,
    handleLeaveLobby,
    handlePlayWithFriends,
  };
}
