import { useCallback, type Dispatch, type RefObject } from "react";

import { abandonGame } from "@/api/games";
import type { Game, GameReview, StatsPeriod } from "@/api/types";
import type { PlaySessionLeave, PlaySessionReview } from "@/hooks/playSessionTypes";
import type { ScreenAction, ScreenState } from "@/hooks/screenState";
import { bestEffort } from "@/lib/api/bestEffort";
import type { GameAssists } from "@/lib/play/gameSettings";

type UsePlaySessionNavigationArgs = {
  screen: ScreenState;
  dispatch: Dispatch<ScreenAction>;
  activeGameRef: RefObject<Game | null>;
  releasePlayLock: () => Promise<void>;
  refreshResumable: () => Promise<unknown>;
  loadStats: (period?: StatsPeriod) => void;
};

function abandonsOnLeave(game: Game | null): game is Game {
  return game !== null && (game.is_analysis || game.is_lesson) && game.status === "in_progress";
}

export function usePlaySessionNavigation({
  screen,
  dispatch,
  activeGameRef,
  releasePlayLock,
  refreshResumable,
  loadStats,
}: UsePlaySessionNavigationArgs) {
  const startPartyGame = useCallback(
    ({ game, assists }: { game: Game; assists: GameAssists }) => {
      dispatch({ type: "startPlay", game, assists });
      void loadStats();
      void refreshResumable();
    },
    [dispatch, loadStats, refreshResumable],
  );

  const openPartyResults = useCallback(
    (partyId: string) => {
      void releasePlayLock();
      dispatch({ type: "openPartyResults", partyId });
      void loadStats();
    },
    [dispatch, loadStats, releasePlayLock],
  );

  const leavePlayTo = useCallback(
    (nextScreen: "home" | "rating") => {
      const game = activeGameRef.current;
      void (async () => {
        if (abandonsOnLeave(game)) {
          await bestEffort("abandon when leaving analysis or a lesson", () =>
            abandonGame(game.id, game.elapsed_seconds),
          );
        }
        await releasePlayLock();
        dispatch({ type: "leave", to: nextScreen });
        void refreshResumable();
      })();
    },
    [activeGameRef, dispatch, refreshResumable, releasePlayLock],
  );

  const goHome = useCallback(() => {
    leavePlayTo("home");
  }, [leavePlayTo]);

  const openRating = useCallback(() => {
    leavePlayTo("rating");
  }, [leavePlayTo]);

  const openReview = useCallback(
    (review: GameReview) => {
      dispatch({ type: "openReview", review });
    },
    [dispatch],
  );

  const backFromReview = useCallback(() => {
    const partyId = screen.name === "review" ? screen.review.party_id : null;
    if (partyId) {
      openPartyResults(partyId);
      return;
    }
    dispatch({ type: "backFromReview" });
  }, [dispatch, openPartyResults, screen]);

  const review: PlaySessionReview = {
    back: backFromReview,
    open: openReview,
    openParty: openPartyResults,
  };
  const leave: PlaySessionLeave = { home: goHome, rating: openRating };
  return { startPartyGame, openPartyResults, review, leave };
}
