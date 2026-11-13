import { useEffect, useState } from "react";

import { GuideRubric } from "@/components/InfoGuideRubrics";
import { GuideLangSwitch } from "@/components/GuideLangSwitch";
import {
  infoGuideCopy,
  loadInfoGuideLang,
  saveInfoGuideLang,
  type GuideRubricId,
  type InfoGuideCopy,
  type InfoGuideLang,
} from "@/content/infoGuideCopy";
import { cn } from "@/lib/classNames";

type InfoPageProps = {
  onGoHome: () => void;
  rubricId: GuideRubricId | null;
  onRubricIdChange: (id: GuideRubricId | null) => void;
  onOpenLearn: () => void;
};

export function InfoPage({ onGoHome, rubricId, onRubricIdChange, onOpenLearn }: InfoPageProps) {
  const [lang, setLang] = useState<InfoGuideLang>(() => loadInfoGuideLang());
  const [assistIndex, setAssistIndex] = useState(0);
  const [paneKey, setPaneKey] = useState(0);
  const assistResetKey = `${rubricId ?? "index"}:${lang}`;
  const [assistResetSeen, setAssistResetSeen] = useState(assistResetKey);
  if (assistResetKey !== assistResetSeen) {
    setAssistResetSeen(assistResetKey);
    setAssistIndex(0);
  }
  const visibleAssistIndex = assistResetKey === assistResetSeen ? assistIndex : 0;
  const copy = infoGuideCopy(lang);

  useEffect(() => {
    saveInfoGuideLang(lang);
  }, [lang]);

  function showRubric(id: GuideRubricId | null) {
    onRubricIdChange(id);
    setPaneKey((current) => current + 1);
  }

  const activeToc = copy.toc.find((item) => item.id === rubricId);
  if (rubricId !== null && activeToc === undefined) {
    throw new Error(`unknown guide rubric: ${rubricId}`);
  }

  return (
    <div className="gazette-home">
      <header className="gazette-home-masthead gazette-stats-masthead">
        <div className="gazette-guide-masthead-row">
          {rubricId === null ? (
            <h1 className="home-masthead gazette-guide-title">{copy.title}</h1>
          ) : (
            <button
              type="button"
              className="gazette-guide-title-back"
              onClick={() => showRubric(null)}
            >
              {copy.title}
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
        className={cn(
          "gazette-stats-ledger gazette-guide-ledger",
          rubricId === null && "gazette-guide-ledger-toc",
        )}
      >
        <div key={paneKey} className="gazette-guide-pane">
          {rubricId === null || activeToc === undefined ? (
            <GuideToc copy={copy} onOpenRubric={showRubric} />
          ) : (
            <GuideRubric
              copy={copy}
              rubricId={rubricId}
              title={activeToc.title}
              assistIndex={visibleAssistIndex}
              onAssistIndexChange={setAssistIndex}
              onOpenLearn={onOpenLearn}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type GuideTocProps = {
  copy: InfoGuideCopy;
  onOpenRubric: (id: GuideRubricId) => void;
};

function GuideToc({ copy, onOpenRubric }: GuideTocProps) {
  const toc = copy.toc;
  return (
    <div className="gazette-guide-toc">
      <p className="gazette-guide-toc-intro">{copy.tocIntro}</p>
      <div className="gazette-stats-ledger-rule" aria-hidden="true" />
      <ul className="gazette-guide-toc-list">
        {toc.flatMap((item, index) => {
          const nodes = [];
          if (index > 0) {
            const previousTitle = toc[index - 1]?.title;
            if (previousTitle === undefined) {
              throw new Error("guide TOC missing previous item");
            }
            nodes.push(
              <li key={`rule-${item.id}`} className="gazette-guide-toc-rule-row" aria-hidden="true">
                <div className="gazette-guide-toc-rule-sizer">
                  <span className="gazette-guide-toc-rule-anchor">{previousTitle}</span>
                  <span className="gazette-guide-toc-rule-anchor">{item.title}</span>
                  <div className="gazette-guide-toc-rule" />
                </div>
              </li>,
            );
          }
          nodes.push(
            <li key={item.id} className="gazette-guide-toc-entry">
              <button
                type="button"
                className="gazette-guide-toc-item"
                onClick={() => onOpenRubric(item.id)}
              >
                <span className="gazette-guide-toc-title">{item.title}</span>
                <span className="gazette-guide-toc-lead">{item.lead}</span>
              </button>
            </li>,
          );
          return nodes;
        })}
      </ul>
    </div>
  );
}
