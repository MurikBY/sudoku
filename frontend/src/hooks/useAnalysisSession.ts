import { useCallback, useState, type Dispatch, type RefObject } from "react";

import { abandonGame, createAnalysisGame } from "@/api/games";
import type { Game } from "@/api/types";
import type { PlaySessionAnalysis } from "@/hooks/playSessionTypes";
import type { ScreenAction, ScreenState } from "@/hooks/screenState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { bestEffort } from "@/lib/api/bestEffort";
import { assistsFromPayload } from "@/lib/play/preferencesSync";

type UseAnalysisSessionArgs = {
  screen: ScreenState;
  dispatch: Dispatch<ScreenAction>;
  ensurePlayLock: () => Promise<boolean>;
  releasePlayLock: () => Promise<void>;
  activeGameRef: RefObject<Game | null>;
};

export function useAnalysisSession({
  screen,
  dispatch,
  ensurePlayLock,
  releasePlayLock,
  activeGameRef,
}: UseAnalysisSessionArgs): PlaySessionAnalysis {
  const [playFromHereBusy, setPlayFromHereBusy] = useState(false);
  const [playFromHereError, setPlayFromHereError] = useState<string | null>(null);

  const handlePlayFromHere = useCallback(
    async (shareCode: string, eventIndex: number) => {
      if (screen.name !== "review") {
        throw new Error("play from here requires a review");
      }
      const review = screen.review;
      if (playFromHereBusy) {
        return;
      }
      if (!(await ensurePlayLock())) {
        return;
      }
      setPlayFromHereBusy(true);
      setPlayFromHereError(null);
      try {
        const game = await createAnalysisGame(shareCode, eventIndex);
        dispatch({
          type: "startAnalysis",
          game,
          assists: assistsFromPayload(review.assists),
          review,
        });
      } catch (error) {
        setPlayFromHereError(formatApiErrorMessage(error));
        await releasePlayLock();
      } finally {
        setPlayFromHereBusy(false);
      }
    },
    [dispatch, ensurePlayLock, playFromHereBusy, releasePlayLock, screen],
  );

  const handleAnalysisComplete = useCallback(() => {
    void releasePlayLock();
    dispatch({ type: "finishAnalysis" });
  }, [dispatch, releasePlayLock]);

  const handleBackFromAnalysis = useCallback(() => {
    const game = activeGameRef.current;
    void (async () => {
      if (game?.is_analysis && game.status === "in_progress") {
        await bestEffort("abandon when leaving analysis", () =>
          abandonGame(game.id, game.elapsed_seconds),
        );
      }
      await releasePlayLock();
      dispatch({ type: "finishAnalysis" });
    })();
  }, [activeGameRef, dispatch, releasePlayLock]);

  return {
    playFromHere: (shareCode, eventIndex) => {
      void handlePlayFromHere(shareCode, eventIndex);
    },
    busy: playFromHereBusy,
    error: playFromHereError,
    onSolved: handleAnalysisComplete,
    backToReview: handleBackFromAnalysis,
  };
}
