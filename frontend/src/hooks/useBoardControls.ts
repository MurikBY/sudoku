import type { Game } from "@/api/types";
import type { ActionSlice, BoardSlice, TimerSlice } from "@/hooks/playBoardSessionTypes";
import { useBoardInput } from "@/hooks/useBoardInput";
import type { useStickyDigit } from "@/hooks/useStickyDigit";
import { boardView } from "@/lib/play/boardView";
import type { GameAssists } from "@/lib/play/gameSettings";

type UseBoardControlsArgs = {
  game: Game;
  board: Pick<
    BoardSlice,
    "selectedIndex" | "isPencilMode" | "conflictIndices" | "wrongDigitIndices"
  >;
  assists: GameAssists;
  play: { isPlaying: boolean; showLessonSuccess: boolean };
  sticky: ReturnType<typeof useStickyDigit>;
  actions: ActionSlice;
  timer: TimerSlice;
  triggerMistakeFeedback: (cellIndex: number) => void;
  prepareGesture: () => void;
};

// What the pad, keys, and actions may do on this board, and the handlers that do it.
export function useBoardControls({
  game,
  board,
  assists,
  play,
  sticky,
  actions,
  timer,
  triggerMistakeFeedback,
  prepareGesture,
}: UseBoardControlsArgs) {
  const { selectedIndex, isPencilMode, conflictIndices, wrongDigitIndices } = board;
  const view = boardView({
    puzzle: game.puzzle,
    currentGrid: game.current_grid,
    notes: game.notes,
    dimCompletedDigits: assists.dimCompletedDigits,
    mistakeFeedback: assists.mistakeFeedback,
    stickyAssist: assists.stickyDigit,
    isPlaying: play.isPlaying,
    showLessonSuccess: play.showLessonSuccess,
    selectedIndex,
    isPencilMode,
    conflictIndices,
    wrongDigitIndices,
    stickyDigit: sticky.stickyDigit,
  });

  const input = useBoardInput({
    gates: {
      canUsePad: view.canUsePad,
      canClear: view.canClear,
      padCompletedDigits: view.padCompletedDigits,
    },
    selection: { selectedIndex, isPencilMode },
    cells: {
      puzzle: game.puzzle,
      currentGrid: game.current_grid,
      notes: game.notes,
    },
    mistakes: {
      feedback: assists.mistakeFeedback,
      wrongDigitIndices,
      trigger: triggerMistakeFeedback,
    },
    commands: {
      applyMove: actions.applyMove,
      toggleNote: actions.toggleNote,
      clearNotes: actions.clearNotes,
      undoLastMove: actions.undoLastMove,
      selectCell: actions.selectCell,
    },
    sticky: {
      digit: sticky.stickyDigit,
      digitRef: sticky.digitRef,
      clear: sticky.clearStickyDigit,
      assist: assists.stickyDigit,
    },
    elapsed: timer,
    prepareGesture,
  });

  return {
    canClear: view.canClear,
    canHint: view.canHint,
    activeDigit: view.activeDigit,
    noteDigits: view.noteDigits,
    visibleWrongDigitIndices: view.visibleWrongDigitIndices,
    padCompletedDigits: view.padCompletedDigits,
    notePaintEnabled: view.notePaintEnabled,
    ...input,
  };
}
