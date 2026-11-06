import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchLessonProgress } from "@/api/games";
import { GuideLangSwitch } from "@/components/GuideLangSwitch";
import { TechniquesGuide } from "@/components/TechniquesGuide";
import { queryLoadError } from "@/lib/api/queryLoadStatus";
import {
  infoGuideCopy,
  loadInfoGuideLang,
  saveInfoGuideLang,
  type InfoGuideLang,
} from "@/content/infoGuideCopy";
import {
  lessonProgressByTechnique,
  techniqueArticle,
  type TechniqueArticleId,
} from "@/content/techniquesGuideCopy";

type LearnPageProps = {
  onGoHome: () => void;
  articleId: TechniqueArticleId | null;
  onArticleIdChange: (articleId: TechniqueArticleId | null) => void;
  onPracticeThis: (technique: TechniqueArticleId) => void;
  practiceBusy: boolean;
  practiceError: string | null;
};

export function LearnPage({
  onGoHome,
  articleId,
  onArticleIdChange,
  onPracticeThis,
  practiceBusy,
  practiceError,
}: LearnPageProps) {
  const [lang, setLang] = useState<InfoGuideLang>(() => loadInfoGuideLang());
  const [paneKey, setPaneKey] = useState(0);
  const [articleTrail, setArticleTrail] = useState<TechniqueArticleId[]>([]);
  const copy = infoGuideCopy(lang);
  const progressQuery = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchLessonProgress(),
    enabled: articleId === null,
  });
  const indexProgressError = queryLoadError(progressQuery);
  const progressError = articleId === null ? indexProgressError : null;
  const progressByTechnique =
    progressQuery.data === undefined || (articleId === null && indexProgressError !== null)
      ? null
      : lessonProgressByTechnique(progressQuery.data.items);

  useEffect(() => {
    saveInfoGuideLang(lang);
  }, [lang]);

  function openArticle(nextArticleId: TechniqueArticleId) {
    setArticleTrail([]);
    onArticleIdChange(nextArticleId);
    setPaneKey((current) => current + 1);
  }

  function openLinkedArticle(nextArticleId: TechniqueArticleId) {
    if (articleId === null || articleId === nextArticleId) {
      throw new Error("linked technique article requires a different current article");
    }
    setArticleTrail((trail) => [...trail, articleId]);
    onArticleIdChange(nextArticleId);
    setPaneKey((current) => current + 1);
  }

  function backFromMasthead() {
    if (articleId === null) {
      throw new Error("learn index has no article back target");
    }
    const previousArticleId = articleTrail[articleTrail.length - 1];
    if (previousArticleId !== undefined) {
      setArticleTrail((trail) => trail.slice(0, -1));
      onArticleIdChange(previousArticleId);
      setPaneKey((current) => current + 1);
      return;
    }
    onArticleIdChange(null);
    setPaneKey((current) => current + 1);
  }

  const article = articleId === null ? null : techniqueArticle(lang, articleId);

  return (
    <div className="gazette-home">
      <header className="gazette-home-masthead gazette-stats-masthead">
        <div className="gazette-guide-masthead-row">
          {articleId === null ? (
            <h1 className="home-masthead gazette-guide-title">Learning</h1>
          ) : (
            <button type="button" className="gazette-guide-title-back" onClick={backFromMasthead}>
              {copy.back}
            </button>
          )}
          <GuideLangSwitch lang={lang} onLangChange={setLang} />
          <button type="button" onClick={onGoHome} className="gazette-guide-go-home">
            {copy.goHome}
          </button>
        </div>
        <div className="gazette-home-masthead-rule" />
      </header>

      <div
        className={
          articleId === null
            ? "gazette-stats-ledger gazette-guide-ledger gazette-guide-ledger-index"
            : "gazette-stats-ledger gazette-guide-ledger"
        }
      >
        <div key={paneKey} className="gazette-guide-pane">
          <div className="gazette-guide-rubric">
            {article !== null && (
              <div className="gazette-guide-rubric-header">
                <h2 className="gazette-guide-rubric-title">{article.name}</h2>
                <div className="gazette-stats-ledger-rule" aria-hidden="true" />
              </div>
            )}
            {articleId === null && progressError !== null && (
              <p className="gazette-guide-paragraph gazette-guide-technique-error">
                {progressError}
              </p>
            )}
            {(articleId !== null || progressByTechnique !== null) && (
              <TechniquesGuide
                lang={lang}
                articleId={articleId}
                progressByTechnique={progressByTechnique}
                onOpenArticle={openArticle}
                onOpenLinkedArticle={openLinkedArticle}
                onPracticeThis={onPracticeThis}
                practiceBusy={practiceBusy}
                practiceError={practiceError}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
