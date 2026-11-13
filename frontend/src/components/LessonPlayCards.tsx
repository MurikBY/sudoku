import { loadInfoGuideLang } from "@/content/infoGuideCopy";
import { lessonArticleId } from "@/lib/play/lessonArticleId";
import type { PlayMode } from "@/lib/play/playMode";
import { lessonStartBrief, techniqueArticle } from "@/content/techniquesGuideCopy";

function LessonBriefCard({
  technique,
  onDismiss,
}: {
  technique: string | null;
  onDismiss: () => void;
}) {
  if (technique === null) {
    throw new Error("lesson game missing lesson_technique");
  }
  const brief = lessonStartBrief(loadInfoGuideLang(), lessonArticleId(technique));
  return (
    <div
      className="lesson-brief-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-brief-title"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="lesson-brief-card">
        <p id="lesson-brief-title" className="lesson-brief-title">
          {brief.title}
        </p>
        <p className="lesson-brief-body">{brief.body}</p>
        <button type="button" className="lesson-brief-action" onClick={onDismiss}>
          {brief.gotIt}
        </button>
      </div>
    </div>
  );
}

function lessonSuccessCopy(technique: string): { title: string; body: string } {
  const articleId = lessonArticleId(technique);
  if (articleId === "pencil") {
    return { title: "Correct!", body: "You filled in the missing pencil marks." };
  }
  return {
    title: "Correct!",
    body: `That was ${techniqueArticle("en", articleId).name}.`,
  };
}

function LessonSuccessCard({
  technique,
  practiceBusy,
  practiceError,
  onKeepSolving,
  onTryAnotherPuzzle,
  onBackToGuide,
}: {
  technique: string | null;
  practiceBusy: boolean;
  practiceError: string | null;
  onKeepSolving: () => void;
  onTryAnotherPuzzle: () => void;
  onBackToGuide: () => void;
}) {
  if (technique === null) {
    throw new Error("lesson game missing lesson_technique");
  }
  const copy = lessonSuccessCopy(technique);
  return (
    <div
      className="lesson-brief-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-success-title"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="lesson-brief-card lesson-brief-card-success">
        <div className="lesson-success-copy">
          <p id="lesson-success-title" className="lesson-brief-title">
            {copy.title}
          </p>
          <p className="lesson-brief-body">{copy.body}</p>
        </div>
        {practiceError !== null && (
          <p className="gazette-guide-paragraph gazette-guide-technique-error">{practiceError}</p>
        )}
        <div className="lesson-brief-actions">
          <button type="button" className="lesson-brief-action" onClick={onKeepSolving}>
            Continue solving this puzzle
          </button>
          <button
            type="button"
            className="lesson-brief-action"
            disabled={practiceBusy}
            onClick={onTryAnotherPuzzle}
          >
            Try another puzzle of this lesson
          </button>
          <button type="button" className="lesson-brief-action" onClick={onBackToGuide}>
            Return to Learning
          </button>
        </div>
      </div>
    </div>
  );
}

type PlayLessonCardsProps = {
  mode: PlayMode;
  technique: string | null;
  showBrief: boolean;
  showSuccess: boolean;
  onDismissBrief: () => void;
  onKeepSolving: () => void;
};

export function PlayLessonCards({
  mode,
  technique,
  showBrief,
  showSuccess,
  onDismissBrief,
  onKeepSolving,
}: PlayLessonCardsProps) {
  return (
    <>
      {showBrief && <LessonBriefCard technique={technique} onDismiss={onDismissBrief} />}
      {mode.kind === "lesson" && showSuccess && (
        <LessonSuccessCard
          technique={technique}
          practiceBusy={mode.practiceBusy}
          practiceError={mode.practiceError}
          onKeepSolving={onKeepSolving}
          onTryAnotherPuzzle={mode.onTryAnotherPuzzle}
          onBackToGuide={mode.onBackToGuide}
        />
      )}
    </>
  );
}
