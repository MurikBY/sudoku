import type { Game, GameReview } from "@/api/types";
import type { GameAssists } from "@/lib/play/gameSettings";
import type { GuideRubricId } from "@/content/infoGuideCopy";
import type { TechniqueArticleId } from "@/content/techniquesGuideCopy";
import type { StatsMode } from "@/hooks/useStatsMode";

export type ScreenState =
  | { name: "home" }
  | { name: "settings" }
  | { name: "rating" }
  | { name: "info"; rubricId: GuideRubricId | null }
  | { name: "learn"; articleId: TechniqueArticleId | null }
  | { name: "stats"; mode: StatsMode; partyId: string | null }
  | { name: "review"; review: GameReview }
  | {
      name: "play";
      game: Game;
      assists: GameAssists;
      paused: boolean;
      analysisReturnReview: GameReview | null;
      learnArticleId: TechniqueArticleId | null;
    };

export type ScreenAction =
  | { type: "leave"; to: "home" | "rating" }
  | { type: "openStats" }
  | { type: "openPartyResults"; partyId: string }
  | { type: "clearStatsParty" }
  | { type: "openSettings" }
  | { type: "openLearn" }
  | { type: "setLearnArticle"; articleId: TechniqueArticleId | null }
  | { type: "openGuide"; rubricId: GuideRubricId | null }
  | { type: "setGuideRubric"; rubricId: GuideRubricId | null }
  | { type: "openReview"; review: GameReview }
  | { type: "backFromReview" }
  | { type: "startPlay"; game: Game; assists: GameAssists }
  | { type: "startAnalysis"; game: Game; assists: GameAssists; review: GameReview }
  | { type: "finishAnalysis" }
  | {
      type: "startLesson";
      game: Game;
      assists: GameAssists;
      articleId: TechniqueArticleId;
    }
  | { type: "backFromLesson" }
  | { type: "setPaused"; paused: boolean };

export const initialScreenState: ScreenState = { name: "home" };

function reject(action: ScreenAction, screen: ScreenState): never {
  throw new Error(`${action.type} is illegal on ${screen.name}`);
}

function playState(
  game: Game,
  assists: GameAssists,
  analysisReturnReview: GameReview | null,
  learnArticleId: TechniqueArticleId | null,
): ScreenState {
  return {
    name: "play",
    game,
    assists,
    paused: false,
    analysisReturnReview,
    learnArticleId,
  };
}

export function screenReducer(screen: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case "leave":
      return { name: action.to };
    case "openStats":
      return { name: "stats", mode: "solo", partyId: null };
    case "openPartyResults":
      return { name: "stats", mode: "pvp", partyId: action.partyId };
    case "clearStatsParty":
      if (screen.name !== "stats") {
        return reject(action, screen);
      }
      return { ...screen, partyId: null };
    case "openSettings":
      return { name: "settings" };
    case "openLearn":
      return { name: "learn", articleId: null };
    case "setLearnArticle":
      if (screen.name !== "learn") {
        return reject(action, screen);
      }
      return { ...screen, articleId: action.articleId };
    case "openGuide":
      return { name: "info", rubricId: action.rubricId };
    case "setGuideRubric":
      if (screen.name !== "info") {
        return reject(action, screen);
      }
      return { ...screen, rubricId: action.rubricId };
    case "openReview":
      return { name: "review", review: action.review };
    case "backFromReview":
      if (screen.name !== "review") {
        return reject(action, screen);
      }
      return { name: "stats", mode: "pvp", partyId: screen.review.party_id };
    case "startPlay":
      return playState(action.game, action.assists, null, null);
    case "startAnalysis":
      return playState(action.game, action.assists, action.review, null);
    case "finishAnalysis":
      if (screen.name !== "play") {
        return reject(action, screen);
      }
      if (screen.analysisReturnReview !== null) {
        return { name: "review", review: screen.analysisReturnReview };
      }
      return { name: "stats", mode: "pvp", partyId: null };
    case "startLesson":
      return playState(action.game, action.assists, null, action.articleId);
    case "backFromLesson":
      if (screen.name !== "play") {
        return reject(action, screen);
      }
      return { name: "learn", articleId: screen.learnArticleId };
    case "setPaused":
      if (screen.name !== "play") {
        return reject(action, screen);
      }
      return { ...screen, paused: action.paused };
    default: {
      const unknownAction: never = action;
      return unknownAction;
    }
  }
}
