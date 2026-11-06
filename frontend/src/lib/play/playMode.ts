import type { Game, GameReview } from "@/api/types";
import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";
import { lessonArticleId } from "@/lib/play/lessonArticleId";

export type PlayMode =
  | { kind: "solo" }
  | {
      kind: "analysis";
      solverDisplayName: string;
      onSolved: () => void;
      onBackToReview: () => void;
    }
  | {
      kind: "lesson";
      onBackToGuide: () => void;
      onTryAnotherPuzzle: () => void;
      practiceBusy: boolean;
      practiceError: string | null;
    };

type PlayModeSource = {
  game: Pick<Game, "is_analysis" | "is_lesson" | "lesson_technique" | "lesson_position_id">;
  analysisReturnReview: Pick<GameReview, "display_name"> | null;
};

type PlayModeHandlers = {
  onAnalysisSolved: () => void;
  onBackToReview: () => void;
  onBackToGuide: () => void;
  onStartPractice: (technique: TechniqueArticleId, excludePositionId: string | undefined) => void;
  practiceBusy: boolean;
  practiceError: string | null;
};

export function playModeFromScreen(screen: PlayModeSource, handlers: PlayModeHandlers): PlayMode {
  if (screen.game.is_analysis && screen.game.is_lesson) {
    throw new Error("analysisMode and lessonMode cannot both be set");
  }
  if (screen.game.is_analysis) {
    return {
      kind: "analysis",
      solverDisplayName: requireSolverDisplayName(screen.analysisReturnReview),
      onSolved: handlers.onAnalysisSolved,
      onBackToReview: handlers.onBackToReview,
    };
  }
  if (screen.game.is_lesson) {
    return {
      kind: "lesson",
      onBackToGuide: handlers.onBackToGuide,
      onTryAnotherPuzzle: () => startAnotherPractice(screen.game, handlers.onStartPractice),
      practiceBusy: handlers.practiceBusy,
      practiceError: handlers.practiceError,
    };
  }
  return { kind: "solo" };
}

function requireSolverDisplayName(review: Pick<GameReview, "display_name"> | null): string {
  const displayName = review?.display_name;
  if (!displayName) {
    throw new Error("analysisSolverDisplayName required in analysis mode");
  }
  return displayName;
}

function startAnotherPractice(
  game: Pick<Game, "lesson_technique" | "lesson_position_id">,
  onStartPractice: PlayModeHandlers["onStartPractice"],
): void {
  const technique = lessonArticleId(game.lesson_technique ?? null);
  if (game.lesson_position_id === null) {
    throw new Error("lesson game missing lesson_position_id");
  }
  onStartPractice(technique, game.lesson_position_id);
}
