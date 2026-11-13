import { useQuery } from "@tanstack/react-query";

import { fetchLessonProgress } from "@/api/games";
import type { LessonProgressResponse } from "@/api/types";
import { queryLoadError, queryLoadReconnecting } from "@/lib/api/queryLoadStatus";
import { completedLessonTally, lessonProgressByTechnique } from "@/content/techniquesGuideCopy";

function learningMenuLabel(payload: LessonProgressResponse | undefined): string {
  if (payload === undefined) {
    return "Learning";
  }
  const tally = completedLessonTally(lessonProgressByTechnique(payload.items));
  return `Learning (${tally.completed}/${tally.total})`;
}

// The home menu shows lesson progress next to Learning once it loads.
export function useLearningMenu() {
  const progressQuery = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchLessonProgress(),
  });
  return {
    label: learningMenuLabel(progressQuery.data),
    error: queryLoadError(progressQuery),
    reconnecting: queryLoadReconnecting(progressQuery),
  };
}
