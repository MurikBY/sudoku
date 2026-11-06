import { useCallback, useState } from "react";

import type { Game, HintResponse } from "@/api/types";
import { applyServerElapsed } from "@/lib/play/applyServerElapsed";
import type { CoachHint } from "@/lib/play/coachHint";
import { coachEpisodeFingerprint, coachHintFromResponse } from "@/lib/play/coachHint";
import { coachMaxLevel } from "@/content/coachHintCopy";

type CoachEpisode = {
  hint: CoachHint;
  level: 1 | 2 | 3;
  fingerprint: string;
};

type UsePlayCoachArgs = {
  game: Game;
  applyCoachHint: (elapsedSeconds: number) => Promise<HintResponse | null>;
  getElapsedSeconds: () => number;
  setElapsedFromServer: (elapsedSeconds: number) => void;
  resumeIfPaused: () => void;
  selectCell: (index: number | null) => void;
};

export function usePlayCoach({
  game,
  applyCoachHint,
  getElapsedSeconds,
  setElapsedFromServer,
  resumeIfPaused,
  selectCell,
}: UsePlayCoachArgs) {
  const [coachEpisode, setCoachEpisode] = useState<CoachEpisode | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const coachFingerprint = coachEpisodeFingerprint(game.current_grid, game.notes);
  if (coachEpisode !== null && coachEpisode.fingerprint !== coachFingerprint) {
    setCoachEpisode(null);
    setCoachOpen(false);
  }
  if (game.lesson_objective_met === true && (coachEpisode !== null || coachOpen)) {
    setCoachEpisode(null);
    setCoachOpen(false);
  }

  const dismissCoachCard = useCallback(() => {
    setCoachOpen(false);
  }, []);

  function handleStrengthenHint() {
    if (coachEpisode === null) {
      return;
    }
    const maxLevel = coachMaxLevel(coachEpisode.hint);
    if (coachEpisode.level >= maxLevel) {
      return;
    }
    setCoachEpisode({
      ...coachEpisode,
      level: (coachEpisode.level + 1) as 1 | 2 | 3,
    });
  }

  const handleHint = useCallback(async () => {
    resumeIfPaused();
    if (game.lesson_objective_met === true) {
      setCoachOpen(false);
      setCoachEpisode(null);
      return;
    }
    if (coachOpen) {
      setCoachOpen(false);
      return;
    }
    selectCell(null);
    const fingerprint = coachEpisodeFingerprint(game.current_grid, game.notes);
    if (coachEpisode !== null && coachEpisode.fingerprint === fingerprint) {
      setCoachOpen(true);
      return;
    }
    const result = await applyCoachHint(getElapsedSeconds());
    if (result === null) {
      return;
    }
    applyServerElapsed(result, setElapsedFromServer);
    if (result.lesson_objective_met === true) {
      setCoachOpen(false);
      setCoachEpisode(null);
      return;
    }
    setCoachEpisode({
      hint: coachHintFromResponse(result),
      level: 1,
      fingerprint: coachEpisodeFingerprint(result.current_grid, result.notes),
    });
    setCoachOpen(true);
  }, [
    applyCoachHint,
    coachEpisode,
    coachOpen,
    game.current_grid,
    game.lesson_objective_met,
    game.notes,
    getElapsedSeconds,
    resumeIfPaused,
    selectCell,
    setElapsedFromServer,
  ]);

  return {
    coachEpisode,
    coachOpen,
    setCoachOpen,
    dismissCoachCard,
    handleStrengthenHint,
    handleHint,
  };
}
