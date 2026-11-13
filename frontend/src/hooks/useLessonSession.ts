import { useCallback, useState, type Dispatch, type RefObject } from "react";

import { abandonGame, createLessonGame } from "@/api/games";
import type { Game } from "@/api/types";
import type { PlaySessionLesson } from "@/hooks/playSessionTypes";
import type { ScreenAction } from "@/hooks/screenState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { bestEffort } from "@/lib/api/bestEffort";
import { assistsFromPayload } from "@/lib/play/preferencesSync";
import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";

type UseLessonSessionArgs = {
  dispatch: Dispatch<ScreenAction>;
  acquirePlayLock: () => Promise<boolean>;
  releasePlayLock: () => Promise<void>;
  activeGameRef: RefObject<Game | null>;
};

export function useLessonSession({
  dispatch,
  acquirePlayLock,
  releasePlayLock,
  activeGameRef,
}: UseLessonSessionArgs): PlaySessionLesson {
  const [lessonStartBusy, setLessonStartBusy] = useState(false);
  const [lessonStartError, setLessonStartError] = useState<string | null>(null);

  const handleStartLesson = useCallback(
    async (
      technique: TechniqueArticleId,
      variant: "taught" | "practice",
      excludePositionId?: string,
    ) => {
      if (lessonStartBusy) {
        return;
      }
      setLessonStartBusy(true);
      setLessonStartError(null);
      try {
        const acquired = await acquirePlayLock();
        if (!acquired) {
          setLessonStartError("Play is locked on another device.");
          return;
        }
        const game = await createLessonGame(technique, variant, excludePositionId);
        dispatch({
          type: "startLesson",
          game,
          assists: assistsFromPayload(game.assists),
          articleId: technique,
        });
      } catch (error) {
        setLessonStartError(formatApiErrorMessage(error));
        await releasePlayLock();
      } finally {
        setLessonStartBusy(false);
      }
    },
    [acquirePlayLock, dispatch, lessonStartBusy, releasePlayLock],
  );

  const handleBackFromLesson = useCallback(() => {
    const game = activeGameRef.current;
    void (async () => {
      if (game?.is_lesson && game.status === "in_progress") {
        await bestEffort("abandon when leaving a lesson", () =>
          abandonGame(game.id, game.elapsed_seconds),
        );
      }
      await releasePlayLock();
      setLessonStartError(null);
      dispatch({ type: "backFromLesson" });
    })();
  }, [activeGameRef, dispatch, releasePlayLock]);

  return {
    start: (technique, variant, excludePositionId) => {
      void handleStartLesson(technique, variant, excludePositionId);
    },
    back: handleBackFromLesson,
    busy: lessonStartBusy,
    error: lessonStartError,
  };
}
