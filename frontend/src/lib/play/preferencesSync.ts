import type { Difficulty } from "@/api/types";
import type { GameAssists, GameSettings } from "@/lib/play/gameSettings";
import { DEFAULT_ASSISTS, DEFAULT_GAME_SETTINGS } from "@/lib/play/gameSettings";

export type AssistsPayload = {
  pencil: boolean;
  highlight_peers: boolean;
  highlight_same_digit: boolean;
  mistake_feedback: boolean;
  dim_completed_digits: boolean;
  unit_complete_animation: boolean;
  auto_clear_notes: boolean;
  sticky_digit: boolean;
};

export type UserPreferences = {
  difficulty: Difficulty;
  assists: AssistsPayload;
  custom_assists: AssistsPayload;
};

export function assistsToPayload(assists: GameAssists): AssistsPayload {
  return {
    pencil: true,
    highlight_peers: assists.highlightPeers,
    highlight_same_digit: assists.highlightSameDigit,
    mistake_feedback: assists.mistakeFeedback,
    dim_completed_digits: assists.dimCompletedDigits,
    unit_complete_animation: assists.unitCompleteAnimation,
    auto_clear_notes: assists.autoClearNotes,
    sticky_digit: assists.stickyDigit,
  };
}

export function assistsFromPayload(payload: AssistsPayload): GameAssists {
  return {
    highlightPeers: payload.highlight_peers,
    highlightSameDigit: payload.highlight_same_digit,
    mistakeFeedback: payload.mistake_feedback,
    dimCompletedDigits: payload.dim_completed_digits,
    unitCompleteAnimation: payload.unit_complete_animation,
    autoClearNotes: payload.auto_clear_notes,
    stickyDigit: payload.sticky_digit,
  };
}

export function settingsToPreferences(settings: GameSettings): UserPreferences {
  const assistsPayload = assistsToPayload(settings.assists);
  return {
    difficulty: settings.difficulty,
    assists: assistsPayload,
    custom_assists: assistsPayload,
  };
}

export function settingsFromPreferences(preferences: UserPreferences): GameSettings {
  return {
    difficulty: preferences.difficulty,
    assists: assistsFromPayload(preferences.assists),
  };
}

export function isDefaultSettings(settings: GameSettings): boolean {
  return (
    settings.difficulty === DEFAULT_GAME_SETTINGS.difficulty &&
    assistsEqual(settings.assists, DEFAULT_ASSISTS)
  );
}

function assistsEqual(left: GameAssists, right: GameAssists): boolean {
  return (
    left.highlightPeers === right.highlightPeers &&
    left.highlightSameDigit === right.highlightSameDigit &&
    left.mistakeFeedback === right.mistakeFeedback &&
    left.dimCompletedDigits === right.dimCompletedDigits &&
    left.unitCompleteAnimation === right.unitCompleteAnimation &&
    left.autoClearNotes === right.autoClearNotes &&
    left.stickyDigit === right.stickyDigit
  );
}
