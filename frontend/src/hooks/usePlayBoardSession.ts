import { useCallback, useState, type PointerEvent as ReactPointerEvent } from "react";

import { type Game, type HintResponse } from "@/api/types";
import { useBoardInput } from "@/hooks/useBoardInput";
import { usePlayCoach } from "@/hooks/usePlayCoach";
import { useStickyDigit } from "@/hooks/useStickyDigit";
import { boardView } from "@/lib/play/boardView";
import { type GameAssists } from "@/lib/play/gameSettings";
import { type PlayMode } from "@/lib/play/playMode";

type BoardSlice = {
  game: Game;
  selectedIndex: number | null;
  isPencilMode: boolean;
  conflictIndices: ReadonlySet<number>;
  wrongDigitIndices: ReadonlySet<number>;
  canUndo: boolean;
};

type PendingSlice = {
  isMovePending: boolean;
  isHintPending: boolean;
  isNotesPending: boolean;
  isUndoPending: boolean;
};

type ActionSlice = {
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

type PlaySlice = {
  isPlaying: boolean;
  showLessonSuccess: boolean;
  isPaused: boolean;
  onResume: () => void;
  mode: PlayMode;
};

type TimerSlice = {
  getElapsedSeconds: () => number;
  setElapsedFromServer: (elapsedSeconds: number) => void;
};

type UsePlayBoardSessionArgs = {
  board: BoardSlice;
  pending: PendingSlice;
  actions: ActionSlice;
  assists: GameAssists;
  play: PlaySlice;
  timer: TimerSlice;
  triggerMistakeFeedback: (cellIndex: number) => void;
};

export function usePlayBoardSession({
  board,
  pending,
  actions,
  assists,
  play,
  timer,
  triggerMistakeFeedback,
}: UsePlayBoardSessionArgs) {
  const { game, selectedIndex, isPencilMode, conflictIndices, wrongDigitIndices, canUndo } = board;
  const { isMovePending, isHintPending, isNotesPending, isUndoPending } = pending;
  const {
    selectCell,
    togglePencilMode,
    applyMove,
    applyCoachHint,
    toggleNote,
    addNote,
    clearNotes,
    undoLastMove,
  } = actions;
  const { isPlaying, showLessonSuccess, isPaused, onResume, mode } = play;
  const { getElapsedSeconds, setElapsedFromServer } = timer;
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const isPartyGame = game.party_id !== null;
  if (lobbyOpen && (!isPartyGame || mode.kind !== "solo")) {
    setLobbyOpen(false);
  }

  const resumeIfPaused = useCallback(() => {
    if (isPaused) {
      onResume();
    }
  }, [isPaused, onResume]);

  const { coachEpisode, coachOpen, dismissCoachCard, handleStrengthenHint, handleHint } =
    usePlayCoach({
      game,
      applyCoachHint,
      getElapsedSeconds,
      setElapsedFromServer,
      resumeIfPaused,
      selectCell,
    });

  const prepareGesture = useCallback(() => {
    dismissCoachCard();
    resumeIfPaused();
  }, [dismissCoachCard, resumeIfPaused]);

  const sticky = useStickyDigit({
    isPlaying,
    stickyAssist: assists.stickyDigit,
    board: {
      puzzle: game.puzzle,
      currentGrid: game.current_grid,
      conflictIndices,
      wrongDigitIndices,
      dimCompletedDigits: assists.dimCompletedDigits,
    },
    addNote,
    getElapsedSeconds,
    prepareGesture,
    selectCell,
  });

  const view = boardView({
    puzzle: game.puzzle,
    currentGrid: game.current_grid,
    notes: game.notes,
    dimCompletedDigits: assists.dimCompletedDigits,
    mistakeFeedback: assists.mistakeFeedback,
    stickyAssist: assists.stickyDigit,
    isPlaying,
    showLessonSuccess,
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
    commands: { applyMove, toggleNote, clearNotes, undoLastMove, selectCell },
    sticky: {
      digit: sticky.stickyDigit,
      digitRef: sticky.digitRef,
      clear: sticky.clearStickyDigit,
      assist: assists.stickyDigit,
    },
    elapsed: { getElapsedSeconds, setElapsedFromServer },
    prepareGesture,
  });

  const handleTogglePencil = useCallback(() => {
    dismissCoachCard();
    resumeIfPaused();
    togglePencilMode();
  }, [dismissCoachCard, resumeIfPaused, togglePencilMode]);

  function clearBoardSelection() {
    if (selectedIndex === null) {
      return;
    }
    selectCell(null);
  }

  function handleBoardBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    dismissCoachCard();
    clearBoardSelection();
  }

  function stopBoardClearPropagation(event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  return {
    lobbyOpen,
    setLobbyOpen,
    stickyDigit: sticky.stickyDigit,
    coachEpisode,
    coachOpen,
    isBusy: isMovePending || isHintPending || isNotesPending || isUndoPending,
    isPencilMode,
    canClear: view.canClear,
    canHint: view.canHint,
    canUndo,
    activeDigit: view.activeDigit,
    noteDigits: view.noteDigits,
    visibleWrongDigitIndices: view.visibleWrongDigitIndices,
    padCompletedDigits: view.padCompletedDigits,
    notePaintEnabled: view.notePaintEnabled,
    dismissCoachCard,
    handleStrengthenHint,
    handleHint,
    handleUndo: input.handleUndo,
    handleTogglePencil,
    handlePick: input.handlePick,
    handleStickyDigit: sticky.handleStickyDigit,
    handlePaintNoteCell: sticky.handlePaintNoteCell,
    handleSelectCell: input.handleSelectCell,
    handleBoardBackgroundPointerDown,
    stopBoardClearPropagation,
    handleClear: input.handleClear,
  };
}
