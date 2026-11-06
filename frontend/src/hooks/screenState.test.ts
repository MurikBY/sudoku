import { describe, expect, it } from "vitest";

import type { Game, GameReview, PartyAssists } from "@/api/types";
import { DEFAULT_ASSISTS } from "@/lib/play/gameSettings";
import { initialScreenState, screenReducer, type ScreenState } from "@/hooks/screenState";

const PARTY_ASSISTS: PartyAssists = {
  pencil: false,
  highlight_peers: false,
  highlight_same_digit: false,
  mistake_feedback: false,
  dim_completed_digits: false,
  unit_complete_animation: false,
  auto_clear_notes: false,
  sticky_digit: false,
};

function game(): Game {
  return {
    id: "game",
    difficulty: "easy",
    status: "in_progress",
    puzzle: "",
    current_grid: "",
    mistakes_count: 0,
    hints_count: 0,
    pencil_count: 0,
    notes: {},
    elapsed_seconds: 0,
    started_at: "",
    completed_at: null,
    party_id: null,
    assists: PARTY_ASSISTS,
    share_code: "",
    is_analysis: false,
    analysis_source_game_id: null,
    is_lesson: false,
    lesson_technique: null,
    lesson_position_id: null,
    lesson_role: null,
    lesson_has_practice: null,
    lesson_objective_met: null,
    lesson_step: null,
    lesson_notes_issue: null,
    conflict_indices: [],
    wrong_digit_indices: [],
    undo_count: 0,
    completion: null,
  };
}

function review(partyId: string | null): GameReview {
  return {
    id: "review",
    share_code: "",
    difficulty: "easy",
    status: "completed",
    puzzle: "",
    solution: "",
    started_at: "",
    completed_at: null,
    elapsed_seconds: 0,
    mistakes_count: 0,
    hints_count: 0,
    pencil_count: 0,
    party_id: partyId,
    is_party: partyId !== null,
    display_name: "",
    assists: PARTY_ASSISTS,
    events: [],
    replay_available: false,
    play_from_here_available: false,
  };
}

describe("screenReducer", () => {
  it("leaves to home or rating from any screen", () => {
    const playing = screenReducer(initialScreenState, {
      type: "startPlay",
      game: game(),
      assists: DEFAULT_ASSISTS,
    });
    expect(screenReducer(playing, { type: "leave", to: "home" })).toEqual({ name: "home" });
    expect(screenReducer(playing, { type: "leave", to: "rating" })).toEqual({ name: "rating" });
  });

  it("opens stats on the solo list", () => {
    expect(screenReducer(initialScreenState, { type: "openStats" })).toEqual({
      name: "stats",
      mode: "solo",
      partyId: null,
    });
  });

  it("opens party results", () => {
    expect(
      screenReducer(initialScreenState, { type: "openPartyResults", partyId: "party-1" }),
    ).toEqual({ name: "stats", mode: "pvp", partyId: "party-1" });
  });

  it("clears the stats party id and keeps the mode", () => {
    const stats: ScreenState = { name: "stats", mode: "pvp", partyId: "party-1" };
    expect(screenReducer(stats, { type: "clearStatsParty" })).toEqual({
      name: "stats",
      mode: "pvp",
      partyId: null,
    });
  });

  it("opens settings", () => {
    expect(screenReducer(initialScreenState, { type: "openSettings" })).toEqual({
      name: "settings",
    });
  });

  it("opens the learn list", () => {
    expect(screenReducer(initialScreenState, { type: "openLearn" })).toEqual({
      name: "learn",
      articleId: null,
    });
  });

  it("sets the learn article", () => {
    const learn = screenReducer(initialScreenState, { type: "openLearn" });
    expect(screenReducer(learn, { type: "setLearnArticle", articleId: "naked_single" })).toEqual({
      name: "learn",
      articleId: "naked_single",
    });
  });

  it("opens a guide rubric", () => {
    expect(screenReducer(initialScreenState, { type: "openGuide", rubricId: null })).toEqual({
      name: "info",
      rubricId: null,
    });
  });

  it("sets the guide rubric", () => {
    const info = screenReducer(initialScreenState, { type: "openGuide", rubricId: null });
    expect(screenReducer(info, { type: "setGuideRubric", rubricId: "assists" })).toEqual({
      name: "info",
      rubricId: "assists",
    });
  });

  it("opens a review", () => {
    const opened = review("party-1");
    expect(screenReducer(initialScreenState, { type: "openReview", review: opened })).toEqual({
      name: "review",
      review: opened,
    });
  });

  it("returns from a review to that party, or to the games list when it has none", () => {
    const withParty = screenReducer(initialScreenState, {
      type: "openReview",
      review: review("party-1"),
    });
    expect(screenReducer(withParty, { type: "backFromReview" })).toEqual({
      name: "stats",
      mode: "pvp",
      partyId: "party-1",
    });
    const staleParty = screenReducer(initialScreenState, {
      type: "openPartyResults",
      partyId: "old",
    });
    const withoutParty = screenReducer(staleParty, {
      type: "openReview",
      review: review(null),
    });
    expect(screenReducer(withoutParty, { type: "backFromReview" })).toEqual({
      name: "stats",
      mode: "pvp",
      partyId: null,
    });
  });

  it("starts play with both return fields clear", () => {
    const started = screenReducer(
      screenReducer(initialScreenState, {
        type: "startLesson",
        game: game(),
        assists: DEFAULT_ASSISTS,
        articleId: "naked_single",
      }),
      { type: "startPlay", game: game(), assists: DEFAULT_ASSISTS },
    );
    expect(started).toMatchObject({
      name: "play",
      paused: false,
      analysisReturnReview: null,
      learnArticleId: null,
    });
  });

  it("starts analysis from the current review", () => {
    const current = review("party-1");
    expect(
      screenReducer(initialScreenState, {
        type: "startAnalysis",
        game: game(),
        assists: DEFAULT_ASSISTS,
        review: current,
      }),
    ).toMatchObject({
      name: "play",
      paused: false,
      analysisReturnReview: current,
      learnArticleId: null,
    });
  });

  it("finishes analysis at the return review, or the games list when there is none", () => {
    const current = review("party-1");
    const analyzing = screenReducer(initialScreenState, {
      type: "startAnalysis",
      game: game(),
      assists: DEFAULT_ASSISTS,
      review: current,
    });
    expect(screenReducer(analyzing, { type: "finishAnalysis" })).toEqual({
      name: "review",
      review: current,
    });
    const afterParty = screenReducer(initialScreenState, {
      type: "openPartyResults",
      partyId: "old",
    });
    const playing = screenReducer(afterParty, {
      type: "startPlay",
      game: game(),
      assists: DEFAULT_ASSISTS,
    });
    expect(screenReducer(playing, { type: "finishAnalysis" })).toEqual({
      name: "stats",
      mode: "pvp",
      partyId: null,
    });
  });

  it("restores the lesson article, and a plain game restores a null article", () => {
    const lesson = screenReducer(initialScreenState, {
      type: "startLesson",
      game: game(),
      assists: DEFAULT_ASSISTS,
      articleId: "naked_single",
    });
    expect(screenReducer(lesson, { type: "backFromLesson" })).toEqual({
      name: "learn",
      articleId: "naked_single",
    });
    const playing = screenReducer(initialScreenState, {
      type: "startPlay",
      game: game(),
      assists: DEFAULT_ASSISTS,
    });
    expect(screenReducer(playing, { type: "backFromLesson" })).toEqual({
      name: "learn",
      articleId: null,
    });
  });

  it("sets the paused flag on the same play payload", () => {
    const playing = screenReducer(initialScreenState, {
      type: "startPlay",
      game: game(),
      assists: DEFAULT_ASSISTS,
    });
    expect(screenReducer(playing, { type: "setPaused", paused: true })).toMatchObject({
      name: "play",
      paused: true,
      game: playing.name === "play" ? playing.game : game(),
    });
  });

  it("throws when setPaused or backFromReview runs from home", () => {
    expect(() => screenReducer(initialScreenState, { type: "setPaused", paused: true })).toThrow(
      "setPaused is illegal on home",
    );
    expect(() => screenReducer(initialScreenState, { type: "backFromReview" })).toThrow(
      "backFromReview is illegal on home",
    );
  });
});
