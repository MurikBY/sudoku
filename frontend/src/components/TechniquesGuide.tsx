import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { fetchTaughtLessonSnapshot } from "@/api/games";
import type { TaughtLessonSnapshot } from "@/api/types";
import { TechniqueLessonBoard } from "@/components/TechniqueLessonBoard";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import type { InfoGuideLang } from "@/content/infoGuideCopy";
import { renderTechniqueNameLinks } from "@/content/renderTechniqueNameLinks";
import {
  techniqueArticle,
  techniquesGuideCopy,
  type TechniqueArticleCopy,
  type TechniqueArticleId,
  type TechniqueProgressCounts,
} from "@/content/techniquesGuideCopy";

type TechniquesGuideProps = {
  lang: InfoGuideLang;
  articleId: TechniqueArticleId | null;
  progressByTechnique: Record<TechniqueArticleId, TechniqueProgressCounts> | null;
  onOpenArticle: (articleId: TechniqueArticleId) => void;
  onOpenLinkedArticle: (articleId: TechniqueArticleId) => void;
  onPracticeThis: (technique: TechniqueArticleId) => void;
  practiceBusy: boolean;
  practiceError: string | null;
};

export function TechniquesGuide({
  lang,
  articleId,
  progressByTechnique,
  onOpenArticle,
  onOpenLinkedArticle,
  onPracticeThis,
  practiceBusy,
  practiceError,
}: TechniquesGuideProps) {
  const copy = techniquesGuideCopy(lang);
  if (articleId === null) {
    if (progressByTechnique === null) {
      throw new Error("technique index requires progress");
    }
    return (
      <div className="gazette-guide-rubric-body gazette-guide-technique-index">
        <p className="gazette-guide-paragraph gazette-guide-paragraph-center">{copy.indexIntro}</p>
        <ul className="gazette-guide-technique-index-list">
          {copy.articles.map((article) => {
            const progress = progressByTechnique[article.id];
            if (progress === undefined) {
              throw new Error(`missing lesson progress: ${article.id}`);
            }
            return (
              <li key={article.id}>
                <button
                  type="button"
                  className="gazette-guide-technique-index-btn"
                  onClick={() => onOpenArticle(article.id)}
                >
                  <span className="gazette-guide-technique-index-name">{article.name}</span>
                  {progress.solvedCount > 0 && (
                    <span className="gazette-guide-technique-index-progress">
                      <Check className="gazette-guide-technique-index-check" aria-hidden />
                      {progress.solvedCount}/{progress.poolSize}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <TechniqueArticle
      lang={lang}
      article={techniqueArticle(lang, articleId)}
      onOpenLinkedArticle={onOpenLinkedArticle}
      onPracticeThis={onPracticeThis}
      practiceBusy={practiceBusy}
      practiceError={practiceError}
    />
  );
}

function TechniqueArticle({
  lang,
  article,
  onOpenLinkedArticle,
  onPracticeThis,
  practiceBusy,
  practiceError,
}: {
  lang: InfoGuideLang;
  article: TechniqueArticleCopy;
  onOpenLinkedArticle: (articleId: TechniqueArticleId) => void;
  onPracticeThis: (technique: TechniqueArticleId) => void;
  practiceBusy: boolean;
  practiceError: string | null;
}) {
  const copy = techniquesGuideCopy(lang);
  const { snapshot, error } = useTaughtLessonSnapshot(article.hasPractice ? article.id : null);
  const loadError = error ?? practiceError;
  return (
    <div className="gazette-guide-technique-page">
      <div className="gazette-guide-rubric-body gazette-guide-technique-article gazette-guide-technique-article-scroll">
        {article.hasPractice && loadError !== null && (
          <p className="gazette-guide-paragraph gazette-guide-technique-error">{loadError}</p>
        )}
        <GuideParagraphs
          paragraphs={article.idea}
          currentArticleId={article.id}
          onOpenLinkedArticle={onOpenLinkedArticle}
        />
        {snapshot !== null && <TechniqueLessonBoard snapshot={snapshot} label={article.name} />}
        <GuideParagraphs
          paragraphs={article.example}
          currentArticleId={article.id}
          onOpenLinkedArticle={onOpenLinkedArticle}
        />
      </div>
      {article.hasPractice && (
        <div className="gazette-guide-practice gazette-guide-practice-dock">
          <button
            type="button"
            className="home-play-button"
            disabled={practiceBusy}
            onClick={() => onPracticeThis(article.id)}
          >
            <span>{copy.practiceThis}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function GuideParagraphs({
  paragraphs,
  currentArticleId,
  onOpenLinkedArticle,
}: {
  paragraphs: string[];
  currentArticleId: TechniqueArticleId;
  onOpenLinkedArticle: (articleId: TechniqueArticleId) => void;
}) {
  return paragraphs.map((paragraph) => (
    <p key={paragraph} className="gazette-guide-paragraph">
      {renderTechniqueNameLinks(paragraph, currentArticleId, onOpenLinkedArticle)}
    </p>
  ));
}

function useTaughtLessonSnapshot(technique: TechniqueArticleId | null): {
  snapshot: TaughtLessonSnapshot | null;
  error: string | null;
} {
  const [loaded, setLoaded] = useState<{
    technique: TechniqueArticleId;
    snapshot: TaughtLessonSnapshot | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (technique === null) {
      return;
    }
    let cancelled = false;
    void fetchTaughtLessonSnapshot(technique)
      .then((payload) => {
        if (!cancelled) {
          setLoaded({ technique, snapshot: payload, error: null });
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoaded({ technique, snapshot: null, error: formatApiErrorMessage(loadError) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [technique]);

  if (technique === null || loaded === null || loaded.technique !== technique) {
    return { snapshot: null, error: null };
  }
  return { snapshot: loaded.snapshot, error: loaded.error };
}
