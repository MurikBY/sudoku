import { describe, expect, it } from "vitest";

import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";
import { playModeFromScreen } from "@/lib/play/playMode";

type SourceGame = {
  is_analysis: boolean;
  is_lesson: boolean;
  lesson_technique?: string | null;
  lesson_position_id?: string | null;
};

function source(game: SourceGame, displayName?: string) {
  return {
    game,
    analysisReturnReview: displayName === undefined ? null : { display_name: displayName },
  };
}

function handlers() {
  const practiceCalls: { technique: TechniqueArticleId; positionId: string | undefined }[] = [];
  const wired = {
    onAnalysisSolved: () => undefined,
    onBackToReview: () => undefined,
    onBackToGuide: () => undefined,
    onStartPractice: (technique: TechniqueArticleId, positionId: string | undefined) => {
      practiceCalls.push({ technique, positionId });
    },
    practiceBusy: false,
    practiceError: null as string | null,
  };
  return { wired, practiceCalls };
}

describe("playModeFromScreen", () => {
  it("returns solo when the game is neither analysis nor a lesson", () => {
    expect(
      playModeFromScreen(source({ is_analysis: false, is_lesson: false }), handlers().wired),
    ).toEqual({
      kind: "solo",
    });
  });

  it("returns analysis with the review display name and the same callbacks", () => {
    const { wired } = handlers();
    expect(
      playModeFromScreen(source({ is_analysis: true, is_lesson: false }, "Ada"), wired),
    ).toEqual({
      kind: "analysis",
      solverDisplayName: "Ada",
      onSolved: wired.onAnalysisSolved,
      onBackToReview: wired.onBackToReview,
    });
  });

  it("rejects analysis without a solver display name", () => {
    const { wired } = handlers();
    expect(() =>
      playModeFromScreen(source({ is_analysis: true, is_lesson: false }), wired),
    ).toThrow("analysisSolverDisplayName required in analysis mode");
    expect(() =>
      playModeFromScreen(source({ is_analysis: true, is_lesson: false }, ""), wired),
    ).toThrow("analysisSolverDisplayName required in analysis mode");
  });

  it("rejects a game that is both analysis and a lesson", () => {
    expect(() =>
      playModeFromScreen(source({ is_analysis: true, is_lesson: true }, "Ada"), handlers().wired),
    ).toThrow("analysisMode and lessonMode cannot both be set");
  });

  it("returns lesson callbacks and copies the practice status", () => {
    const { wired, practiceCalls } = handlers();
    wired.practiceBusy = true;
    wired.practiceError = "Play is locked on another device.";
    const mode = playModeFromScreen(
      source({
        is_analysis: false,
        is_lesson: true,
        lesson_technique: "naked_single",
        lesson_position_id: "pos-1",
      }),
      wired,
    );
    if (mode.kind !== "lesson") {
      throw new Error("expected lesson mode");
    }
    mode.onTryAnotherPuzzle();
    expect(practiceCalls).toEqual([{ technique: "naked_single", positionId: "pos-1" }]);
    expect(mode.onBackToGuide).toBe(wired.onBackToGuide);
    expect(mode.practiceBusy).toBe(true);
    expect(mode.practiceError).toBe("Play is locked on another device.");
  });

  it("throws the missing position id when try another is used", () => {
    const { wired, practiceCalls } = handlers();
    const mode = playModeFromScreen(
      source({
        is_analysis: false,
        is_lesson: true,
        lesson_technique: "naked_single",
        lesson_position_id: null,
      }),
      wired,
    );
    if (mode.kind !== "lesson") {
      throw new Error("expected lesson mode");
    }
    expect(() => mode.onTryAnotherPuzzle()).toThrow("lesson game missing lesson_position_id");
    expect(practiceCalls).toEqual([]);
  });

  it("throws the missing technique when try another is used", () => {
    const { wired, practiceCalls } = handlers();
    const mode = playModeFromScreen(
      source({
        is_analysis: false,
        is_lesson: true,
        lesson_technique: null,
        lesson_position_id: "pos-1",
      }),
      wired,
    );
    if (mode.kind !== "lesson") {
      throw new Error("expected lesson mode");
    }
    expect(() => mode.onTryAnotherPuzzle()).toThrow("lesson game missing lesson_technique");
    expect(practiceCalls).toEqual([]);
  });
});
