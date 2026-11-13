import { useCallback, useState } from "react";

import type { GameReview } from "@/api/types";
import { formatApiErrorMessage } from "@/lib/api/apiError";

type UseReviewOpenerArgs = {
  onOpenReview: (review: GameReview) => void;
  setError: (error: string | null) => void;
};

export function useReviewOpener({ onOpenReview, setError }: UseReviewOpenerArgs) {
  const [reviewBusy, setReviewBusy] = useState(false);

  const openReview = useCallback(
    async (fetchReview: () => Promise<GameReview>) => {
      setReviewBusy(true);
      setError(null);
      try {
        onOpenReview(await fetchReview());
      } catch (loadError) {
        setError(formatApiErrorMessage(loadError));
      } finally {
        setReviewBusy(false);
      }
    },
    [onOpenReview, setError],
  );

  return { reviewBusy, openReview };
}
