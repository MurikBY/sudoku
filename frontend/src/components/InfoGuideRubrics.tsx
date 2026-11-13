import { GuideAssistPreview } from "@/components/GuideAssistPreview";
import {
  type GuideAssistPreviewId,
  type GuideRubricId,
  type InfoGuideCopy,
} from "@/content/infoGuideCopy";
import { renderGuideMarkedText } from "@/content/renderGuideMarkedText";
import { cn } from "@/lib/classNames";

const ASSIST_NAME_ROWS: GuideAssistPreviewId[][] = [
  ["highlightPeers"],
  ["highlightSameDigit"],
  ["mistakeFeedback"],
  ["dimCompletedDigits", "unitCompleteAnimation"],
  ["autoClearNotes", "stickyDigit"],
];

type GuideRubricProps = {
  copy: InfoGuideCopy;
  rubricId: GuideRubricId;
  title: string;
  assistIndex: number;
  onAssistIndexChange: (index: number) => void;
  onOpenLearn: () => void;
};

export function GuideRubric({
  copy,
  rubricId,
  title,
  assistIndex,
  onAssistIndexChange,
  onOpenLearn,
}: GuideRubricProps) {
  return (
    <div className="gazette-guide-rubric">
      <div className="gazette-guide-rubric-header">
        <h2 className="gazette-guide-rubric-title">{title}</h2>
        <div className="gazette-stats-ledger-rule" aria-hidden="true" />
      </div>

      <div className="gazette-guide-rubric-scroll">
        {rubricId === "difficulty" && <DifficultyRubric copy={copy} onOpenLearn={onOpenLearn} />}
        {rubricId === "assists" && (
          <AssistsRubric
            copy={copy}
            assistIndex={assistIndex}
            onAssistIndexChange={onAssistIndexChange}
          />
        )}
        {rubricId === "friends" && <FriendsRubric copy={copy} />}
        {rubricId === "other" && <OtherRubric copy={copy} />}
      </div>
    </div>
  );
}

function DifficultyRubric({ copy, onOpenLearn }: { copy: InfoGuideCopy; onOpenLearn: () => void }) {
  return (
    <div className="gazette-guide-rubric-body gazette-guide-rubric-fill">
      <div className="gazette-guide-levels">
        {copy.difficulty.levels.map((level) => (
          <article key={level.level} className="gazette-guide-level">
            <h3 className="gazette-guide-level-name">{level.level}</h3>
            <p className="gazette-guide-level-tech">{level.techniques}</p>
          </article>
        ))}
      </div>
      <button type="button" className="gazette-guide-difficulty-link" onClick={onOpenLearn}>
        {copy.difficulty.techniquesLink}
      </button>
    </div>
  );
}

type AssistsRubricProps = {
  copy: InfoGuideCopy;
  assistIndex: number;
  onAssistIndexChange: (index: number) => void;
};

function AssistsRubric({ copy, assistIndex, onAssistIndexChange }: AssistsRubricProps) {
  const activeAssist = copy.assists.items[assistIndex];
  if (activeAssist === undefined) {
    throw new Error(`missing guide assist at index ${assistIndex}`);
  }
  return (
    <div className="gazette-guide-rubric-body gazette-guide-rubric-fill gazette-guide-assists">
      <p className="gazette-guide-paragraph">{copy.assists.intro}</p>
      <div className="gazette-guide-assist-names" role="tablist">
        {ASSIST_NAME_ROWS.map((row) => (
          <div key={row.join("-")} className="gazette-guide-assist-name-row">
            {row.map((previewId) => (
              <AssistNameTab
                key={previewId}
                copy={copy}
                previewId={previewId}
                activeIndex={assistIndex}
                onSelect={onAssistIndexChange}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="gazette-guide-assist-detail">
        <GuideAssistPreview previewId={activeAssist.previewId} />
        <p className="gazette-guide-assist-detail-label">{activeAssist.label}</p>
        <p className="gazette-guide-paragraph">{renderGuideMarkedText(activeAssist.description)}</p>
      </div>
    </div>
  );
}

type AssistNameTabProps = {
  copy: InfoGuideCopy;
  previewId: GuideAssistPreviewId;
  activeIndex: number;
  onSelect: (index: number) => void;
};

function AssistNameTab({ copy, previewId, activeIndex, onSelect }: AssistNameTabProps) {
  const itemIndex = copy.assists.items.findIndex((item) => item.previewId === previewId);
  if (itemIndex < 0) {
    throw new Error(`Missing guide assist: ${previewId}`);
  }
  const item = copy.assists.items[itemIndex];
  const isActive = itemIndex === activeIndex;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn("gazette-guide-assist-name", isActive && "gazette-guide-assist-name-active")}
      onClick={() => onSelect(itemIndex)}
    >
      {item.label}
    </button>
  );
}

function FriendsRubric({ copy }: { copy: InfoGuideCopy }) {
  return (
    <div className="gazette-guide-rubric-body gazette-guide-rubric-fill gazette-guide-friends">
      {copy.friends.sections.map((section) => (
        <section key={section.title} className="gazette-guide-friends-section">
          <h3 className="gazette-guide-friends-heading">{section.title}</h3>
          <p className="gazette-guide-paragraph">{renderGuideMarkedText(section.body)}</p>
        </section>
      ))}
    </div>
  );
}

function OtherRubric({ copy }: { copy: InfoGuideCopy }) {
  return (
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
  );
}
