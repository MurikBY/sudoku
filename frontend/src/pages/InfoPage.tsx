import { useEffect, useState } from "react";

import { GuideAssistPreview } from "@/components/GuideAssistPreview";
import { GuideLangSwitch } from "@/components/GuideLangSwitch";
import {
  infoGuideCopy,
  loadInfoGuideLang,
  saveInfoGuideLang,
  type GuideAssistPreviewId,
  type GuideRubricId,
  type InfoGuideLang,
} from "@/content/infoGuideCopy";
import { renderGuideMarkedText } from "@/content/renderGuideMarkedText";
import { cn } from "@/lib/classNames";

type InfoPageProps = {
  onGoHome: () => void;
  rubricId: GuideRubricId | null;
  onRubricIdChange: (id: GuideRubricId | null) => void;
  onOpenLearn: () => void;
};

const ASSIST_NAME_ROWS: GuideAssistPreviewId[][] = [
  ["highlightPeers"],
  ["highlightSameDigit"],
  ["mistakeFeedback"],
  ["dimCompletedDigits", "unitCompleteAnimation"],
  ["autoClearNotes", "stickyDigit"],
];

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
  const toc = copy.toc;

  useEffect(() => {
    saveInfoGuideLang(lang);
  }, [lang]);

  function openRubric(id: GuideRubricId) {
    onRubricIdChange(id);
    setPaneKey((current) => current + 1);
  }

  function backFromMasthead() {
    onRubricIdChange(null);
    setPaneKey((current) => current + 1);
  }

  const activeToc = toc.find((item) => item.id === rubricId);
  if (rubricId !== null && activeToc === undefined) {
    throw new Error(`unknown guide rubric: ${rubricId}`);
  }
  const activeAssist = copy.assists.items[visibleAssistIndex];
  if (activeAssist === undefined) {
    throw new Error(`missing guide assist at index ${visibleAssistIndex}`);
  }
  const rubricTitle = activeToc?.title;

  return (
    <div className="gazette-home">
      <header className="gazette-home-masthead gazette-stats-masthead">
        <div className="gazette-guide-masthead-row">
          {rubricId === null ? (
            <h1 className="home-masthead gazette-guide-title">{copy.title}</h1>
          ) : (
            <button type="button" className="gazette-guide-title-back" onClick={backFromMasthead}>
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
          {rubricId === null ? (
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
                      <li
                        key={`rule-${item.id}`}
                        className="gazette-guide-toc-rule-row"
                        aria-hidden="true"
                      >
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
                        onClick={() => openRubric(item.id)}
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
          ) : (
            <div className="gazette-guide-rubric">
              <div className="gazette-guide-rubric-header">
                <h2 className="gazette-guide-rubric-title">{rubricTitle}</h2>
                <div className="gazette-stats-ledger-rule" aria-hidden="true" />
              </div>

              <div className="gazette-guide-rubric-scroll">
                {rubricId === "difficulty" && (
                  <div className="gazette-guide-rubric-body gazette-guide-rubric-fill">
                    <div className="gazette-guide-levels">
                      {copy.difficulty.levels.map((level) => (
                        <article key={level.level} className="gazette-guide-level">
                          <h3 className="gazette-guide-level-name">{level.level}</h3>
                          <p className="gazette-guide-level-tech">{level.techniques}</p>
                        </article>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="gazette-guide-difficulty-link"
                      onClick={onOpenLearn}
                    >
                      {copy.difficulty.techniquesLink}
                    </button>
                  </div>
                )}

                {rubricId === "assists" && (
                  <div className="gazette-guide-rubric-body gazette-guide-rubric-fill gazette-guide-assists">
                    <p className="gazette-guide-paragraph">{copy.assists.intro}</p>
                    <div className="gazette-guide-assist-names" role="tablist">
                      {ASSIST_NAME_ROWS.map((row) => (
                        <div key={row.join("-")} className="gazette-guide-assist-name-row">
                          {row.map((previewId) => {
                            const itemIndex = copy.assists.items.findIndex(
                              (item) => item.previewId === previewId,
                            );
                            if (itemIndex < 0) {
                              throw new Error(`Missing guide assist: ${previewId}`);
                            }
                            const item = copy.assists.items[itemIndex];
                            const isActive = itemIndex === visibleAssistIndex;
                            return (
                              <button
                                key={previewId}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                className={cn(
                                  "gazette-guide-assist-name",
                                  isActive && "gazette-guide-assist-name-active",
                                )}
                                onClick={() => setAssistIndex(itemIndex)}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    <div className="gazette-guide-assist-detail">
                      <GuideAssistPreview previewId={activeAssist.previewId} />
                      <p className="gazette-guide-assist-detail-label">{activeAssist.label}</p>
                      <p className="gazette-guide-paragraph">
                        {renderGuideMarkedText(activeAssist.description)}
                      </p>
                    </div>
                  </div>
                )}

                {rubricId === "friends" && (
                  <div className="gazette-guide-rubric-body gazette-guide-rubric-fill gazette-guide-friends">
                    {copy.friends.sections.map((section) => (
                      <section key={section.title} className="gazette-guide-friends-section">
                        <h3 className="gazette-guide-friends-heading">{section.title}</h3>
                        <p className="gazette-guide-paragraph">
                          {renderGuideMarkedText(section.body)}
                        </p>
                      </section>
                    ))}
                  </div>
                )}

                {rubricId === "other" && (
                  <div className="gazette-guide-rubric-body gazette-guide-rubric-fill">
                    {copy.other.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="gazette-guide-paragraph">
                        {renderGuideMarkedText(paragraph)}
                      </p>
                    ))}
                    <ul className="gazette-guide-faq">
                      {copy.other.items.map((item) => (
                        <li key={item.question} className="gazette-guide-faq-item">
                          <h3 className="gazette-guide-faq-q">{item.question}</h3>
                          <p className="gazette-guide-paragraph gazette-guide-faq-a">
                            {renderGuideMarkedText(item.answer)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
