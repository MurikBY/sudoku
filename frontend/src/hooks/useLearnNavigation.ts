import { useState } from "react";

import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";

type UseLearnNavigationArgs = {
  articleId: TechniqueArticleId | null;
  onArticleIdChange: (articleId: TechniqueArticleId | null) => void;
};

// Links between articles push a trail, so Back walks it before returning to the index.
// Every move gets a new pane key, which remounts the pane and replays its entry animation.
export function useLearnNavigation({ articleId, onArticleIdChange }: UseLearnNavigationArgs) {
  const [paneKey, setPaneKey] = useState(0);
  const [articleTrail, setArticleTrail] = useState<TechniqueArticleId[]>([]);

  function showArticle(nextArticleId: TechniqueArticleId | null) {
    onArticleIdChange(nextArticleId);
    setPaneKey((current) => current + 1);
  }

  function openArticle(nextArticleId: TechniqueArticleId) {
    setArticleTrail([]);
    showArticle(nextArticleId);
  }

  function openLinkedArticle(nextArticleId: TechniqueArticleId) {
    if (articleId === null || articleId === nextArticleId) {
      throw new Error("linked technique article requires a different current article");
    }
    setArticleTrail((trail) => [...trail, articleId]);
    showArticle(nextArticleId);
  }

  function goBack() {
    if (articleId === null) {
      throw new Error("learn index has no article back target");
    }
    const previousArticleId = articleTrail[articleTrail.length - 1];
    if (previousArticleId !== undefined) {
      setArticleTrail((trail) => trail.slice(0, -1));
      showArticle(previousArticleId);
      return;
    }
    showArticle(null);
  }

  return { paneKey, openArticle, openLinkedArticle, goBack };
}
