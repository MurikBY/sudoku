import type { Game } from "@/api/types";

const EMPTY_INDEX_SET = new Set<number>();

type PlayPhase = "playing" | "completing" | "completed";

export type BoardState = {
  phase: PlayPhase;
  game: Game;
  error: string | null;
  selectedIndex: number | null;
  isPencilMode: boolean;
  conflictIndices: Set<number>;
  wrongDigitIndices: Set<number>;
};

export type BoardAction =
  | { type: "replaceGame"; game: Game }
  | { type: "storeGame"; game: Game }
  | { type: "select"; index: number | null }
  | { type: "setSelectedIndex"; index: number | null }
  | { type: "togglePencil" }
  | { type: "clearSelection" }
  | { type: "setPhase"; phase: PlayPhase }
  | { type: "setError"; error: string }
  | { type: "clearError" }
  | { type: "setPencil"; pencil: boolean };

export function initialBoardState(initialGame: Game): BoardState {
  return {
    phase: initialGame.status === "completed" ? "completed" : "playing",
    game: initialGame,
    error: null,
    selectedIndex: null,
    isPencilMode: false,
    conflictIndices: new Set(initialGame.conflict_indices),
    wrongDigitIndices: new Set(initialGame.wrong_digit_indices),
  };
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "replaceGame":
      return {
        ...state,
        game: action.game,
        conflictIndices: new Set(action.game.conflict_indices),
        wrongDigitIndices: new Set(action.game.wrong_digit_indices),
      };
    case "storeGame":
      return { ...state, game: action.game };
    case "select":
      if (state.game.status !== "in_progress") {
        return state;
      }
      return { ...state, selectedIndex: action.index };
    case "setSelectedIndex":
      return { ...state, selectedIndex: action.index };
    case "togglePencil":
      return { ...state, isPencilMode: !state.isPencilMode };
    case "clearSelection":
      return {
        ...state,
        selectedIndex: null,
        conflictIndices: EMPTY_INDEX_SET,
        wrongDigitIndices: EMPTY_INDEX_SET,
      };
    case "setPhase":
      return { ...state, phase: action.phase };
    case "setError":
      return { ...state, error: action.error };
    case "clearError":
      return { ...state, error: null };
    case "setPencil":
      return { ...state, isPencilMode: action.pencil };
    default: {
      const unknownAction: never = action;
      return unknownAction;
    }
  }
}
