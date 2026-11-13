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

function strengthenedEpisode(episode: CoachEpisode): CoachEpisode | null {
  if (episode.level >= coachMaxLevel(episode.hint)) {
    return null;
  }
  return { ...episode, level: (episode.level + 1) as 1 | 2 | 3 };
}

function episodeFromHint(result: HintResponse): CoachEpisode {
  return {
    hint: coachHintFromResponse(result),
    level: 1,
    fingerprint: coachEpisodeFingerprint(result.current_grid, result.notes),
  };
}

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
  // An episode belongs to one board: any edit, or a met lesson objective, ends it.
  const episodeIsStale = coachEpisode !== null && coachEpisode.fingerprint !== coachFingerprint;
  const lessonDone = game.lesson_objective_met === true && (coachEpisode !== null || coachOpen);
  if (episodeIsStale || lessonDone) {
    setCoachEpisode(null);
    setCoachOpen(false);
  }

  const dismissCoachCard = useCallback(() => {
    setCoachOpen(false);
  }, []);

  const resetCoach = useCallback(() => {
    setCoachOpen(false);
    setCoachEpisode(null);
  }, []);

  function handleStrengthenHint() {
    const next = coachEpisode === null ? null : strengthenedEpisode(coachEpisode);
    if (next !== null) {
      setCoachEpisode(next);
    }
  }

  const handleHint = useCallback(async () => {
    resumeIfPaused();
    if (game.lesson_objective_met === true) {
      resetCoach();
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
      resetCoach();
      return;
    }
    setCoachEpisode(episodeFromHint(result));
    setCoachOpen(true);
  }, [
    applyCoachHint,
    coachEpisode,
    coachOpen,
    game.current_grid,
    game.lesson_objective_met,
    game.notes,
    getElapsedSeconds,
    resetCoach,
    resumeIfPaused,
    selectCell,
    setElapsedFromServer,
  ]);

  return { coachEpisode, coachOpen, dismissCoachCard, handleStrengthenHint, handleHint };
}
