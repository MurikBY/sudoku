import { useEffect, useState } from "react";

import { GuideLangSwitch } from "@/components/GuideLangSwitch";
import { TechniquesGuide } from "@/components/TechniquesGuide";
import { useLearnNavigation } from "@/hooks/useLearnNavigation";
import { useLearnProgress } from "@/hooks/useLearnProgress";
import {
  infoGuideCopy,
  loadInfoGuideLang,
  saveInfoGuideLang,
  type InfoGuideLang,
} from "@/content/infoGuideCopy";
import { techniqueArticle, type TechniqueArticleId } from "@/content/techniquesGuideCopy";

type LearnPageProps = {
  onGoHome: () => void;
  articleId: TechniqueArticleId | null;
  onArticleIdChange: (articleId: TechniqueArticleId | null) => void;
  onPracticeThis: (technique: TechniqueArticleId) => void;
  practiceBusy: boolean;
  practiceError: string | null;
};

type LearnMastheadProps = {
  lang: InfoGuideLang;
  showBack: boolean;
  onBack: () => void;
  onLangChange: (lang: InfoGuideLang) => void;
  onGoHome: () => void;
};

function LearnMasthead({ lang, showBack, onBack, onLangChange, onGoHome }: LearnMastheadProps) {
  const copy = infoGuideCopy(lang);
  return (
    <header className="gazette-home-masthead gazette-stats-masthead">
      <div className="gazette-guide-masthead-row">
        {showBack ? (
          <button type="button" className="gazette-guide-title-back" onClick={onBack}>
            {copy.back}
          </button>
        ) : (
          <h1 className="home-masthead gazette-guide-title">Learning</h1>
        )}
        <GuideLangSwitch lang={lang} onLangChange={onLangChange} />
        <button type="button" onClick={onGoHome} className="gazette-guide-go-home">
          {copy.goHome}
        </button>
      </div>
      <div className="gazette-home-masthead-rule" />
    </header>
  );
}

export function LearnPage({
  onGoHome,
  articleId,
  onArticleIdChange,
  onPracticeThis,
  practiceBusy,
  practiceError,
}: LearnPageProps) {
  const [lang, setLang] = useState<InfoGuideLang>(() => loadInfoGuideLang());
  const navigation = useLearnNavigation({ articleId, onArticleIdChange });
  const { progressError, progressByTechnique } = useLearnProgress(articleId);

  useEffect(() => {
    saveInfoGuideLang(lang);
  }, [lang]);

  const article = articleId === null ? null : techniqueArticle(lang, articleId);

  return (
    <div className="gazette-home">
      <LearnMasthead
        lang={lang}
        showBack={articleId !== null}
        onBack={navigation.goBack}
        onLangChange={setLang}
        onGoHome={onGoHome}
      />
      <div
        className={
          articleId === null
            ? "gazette-stats-ledger gazette-guide-ledger gazette-guide-ledger-index"
            : "gazette-stats-ledger gazette-guide-ledger"
        }
      >
        <div key={navigation.paneKey} className="gazette-guide-pane">
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
                onOpenArticle={navigation.openArticle}
                onOpenLinkedArticle={navigation.openLinkedArticle}
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
