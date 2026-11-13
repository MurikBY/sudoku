import { useEffect, useRef, type Dispatch } from "react";

import { fetchGameReviewByCode } from "@/api/games";
import type { ScreenAction } from "@/hooks/screenState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { readTelegramDeepLink } from "@/lib/telegram/readTelegramDeepLink";

type UseTelegramDeepLinkArgs = {
  dispatch: Dispatch<ScreenAction>;
  openPartyResults: (partyId: string) => void;
  playLockIsHeld: () => Promise<boolean>;
  openLobbyWithInviteCode: (code: string) => Promise<void>;
  onError: (message: string) => void;
};

// The start parameter is read once per launch: party results, a lobby invite, or a review code.
export function useTelegramDeepLink({
  dispatch,
  openPartyResults,
  playLockIsHeld,
  openLobbyWithInviteCode,
  onError,
}: UseTelegramDeepLinkArgs) {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    const deepLink = readTelegramDeepLink();
    if (!deepLink) {
      return;
    }
    handledRef.current = true;
    if (deepLink.kind === "party") {
      openPartyResults(deepLink.partyId);
      return;
    }
    if (deepLink.kind === "lobby") {
      void (async () => {
        if (!(await playLockIsHeld())) {
          return;
        }
        await openLobbyWithInviteCode(deepLink.code);
      })();
      return;
    }
    void fetchGameReviewByCode(deepLink.code)
      .then((review) => {
        dispatch({ type: "openReview", review });
      })
      .catch((error) => {
        onError(formatApiErrorMessage(error));
      });
  }, [dispatch, onError, openLobbyWithInviteCode, openPartyResults, playLockIsHeld]);
}
