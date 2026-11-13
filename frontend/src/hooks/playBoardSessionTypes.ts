import type { Game, HintResponse } from "@/api/types";
import type { PlayMode } from "@/lib/play/playMode";

export type BoardSlice = {
  game: Game;
  selectedIndex: number | null;
  isPencilMode: boolean;
  conflictIndices: ReadonlySet<number>;
  wrongDigitIndices: ReadonlySet<number>;
  canUndo: boolean;
};

export type PendingSlice = {
  isMovePending: boolean;
  isHintPending: boolean;
  isNotesPending: boolean;
  isUndoPending: boolean;
};

export type ActionSlice = {
  selectCell: (index: number | null) => void;
  togglePencilMode: () => void;
  applyMove: (
    value: number,
    elapsedSeconds: number,
    cellIndex?: number,
  ) => Promise<(Game & { is_mistake?: boolean }) | null>;
  applyCoachHint: (elapsedSeconds: number) => Promise<HintResponse | null>;
  toggleNote: (digit: number, elapsedSeconds: number, cellIndex?: number) => Promise<Game | null>;
  addNote: (digit: number, elapsedSeconds: number, cellIndex: number) => Promise<Game | null>;
  clearNotes: (elapsedSeconds: number) => Promise<Game | null>;
  undoLastMove: (elapsedSeconds: number) => Promise<Game | null>;
};

export type PlaySlice = {
  isPlaying: boolean;
  showLessonSuccess: boolean;
  isPaused: boolean;
  onResume: () => void;
  mode: PlayMode;
};

export type TimerSlice = {
  getElapsedSeconds: () => number;
  setElapsedFromServer: (elapsedSeconds: number) => void;
};
