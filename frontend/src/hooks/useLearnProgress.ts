import { useQuery } from "@tanstack/react-query";

import { fetchLessonProgress } from "@/api/games";
import { queryLoadError } from "@/lib/api/queryLoadStatus";
import { lessonProgressByTechnique, type TechniqueArticleId } from "@/content/techniquesGuideCopy";

// The index needs lesson progress; an article does not, so the query runs only on the index.
export function useLearnProgress(articleId: TechniqueArticleId | null) {
  const progressQuery = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchLessonProgress(),
    enabled: articleId === null,
  });
  const indexProgressError = queryLoadError(progressQuery);
  const progressByTechnique =
    progressQuery.data === undefined || (articleId === null && indexProgressError !== null)
      ? null
      : lessonProgressByTechnique(progressQuery.data.items);
  return {
    progressError: articleId === null ? indexProgressError : null,
    progressByTechnique,
  };
}
