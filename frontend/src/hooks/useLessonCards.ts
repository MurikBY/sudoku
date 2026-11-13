import { useState } from "react";

import type { Game } from "@/api/types";
import type { PlayMode } from "@/lib/play/playMode";

type UseLessonCardsArgs = {
  mode: PlayMode;
  game: Game;
  isPlaying: boolean;
  isCompleted: boolean;
};

export function useLessonCards({ mode, game, isPlaying, isCompleted }: UseLessonCardsArgs) {
  const [keepSolving, setKeepSolving] = useState(false);
  const [briefOpen, setBriefOpen] = useState(mode.kind === "lesson");
  if (mode.kind === "lesson" && game.lesson_objective_met === null) {
    throw new Error("lesson game missing lesson_objective_met");
  }
  if (mode.kind === "lesson" && game.lesson_has_practice === null) {
    throw new Error("lesson game missing lesson_has_practice");
  }
  const showSuccess =
    mode.kind === "lesson" &&
    game.lesson_objective_met === true &&
    !keepSolving &&
    (isPlaying || isCompleted);
  return {
    keepSolving,
    showSuccess,
    showBrief: mode.kind === "lesson" && isPlaying && !showSuccess && briefOpen,
    continueSolving: () => setKeepSolving(true),
    dismissBrief: () => setBriefOpen(false),
  };
}
