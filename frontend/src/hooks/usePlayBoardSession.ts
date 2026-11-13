import { useCallback } from "react";

import type {
  ActionSlice,
  BoardSlice,
  PendingSlice,
  PlaySlice,
  TimerSlice,
} from "@/hooks/playBoardSessionTypes";
import { useBoardBackgroundClear } from "@/hooks/useBoardBackgroundClear";
import { useBoardControls } from "@/hooks/useBoardControls";
import { useLobbyPanelOpen } from "@/hooks/useLobbyPanelOpen";
import { usePlayCoach } from "@/hooks/usePlayCoach";
import { useStickyDigit } from "@/hooks/useStickyDigit";
import { type GameAssists } from "@/lib/play/gameSettings";

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
  const { selectCell, togglePencilMode, addNote } = actions;
  const { isPlaying, showLessonSuccess, isPaused, onResume, mode } = play;
  const { getElapsedSeconds, setElapsedFromServer } = timer;
  const { lobbyOpen, setLobbyOpen } = useLobbyPanelOpen(game.party_id !== null, mode);

  const resumeIfPaused = useCallback(() => {
    if (isPaused) {
      onResume();
    }
  }, [isPaused, onResume]);

  const coach = usePlayCoach({
    game,
    applyCoachHint: actions.applyCoachHint,
    getElapsedSeconds,
    setElapsedFromServer,
    resumeIfPaused,
    selectCell,
  });
  const { dismissCoachCard } = coach;

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

  const controls = useBoardControls({
    game,
    board: { selectedIndex, isPencilMode, conflictIndices, wrongDigitIndices },
    assists,
    play: { isPlaying, showLessonSuccess },
    sticky,
    actions,
    timer,
    triggerMistakeFeedback,
    prepareGesture,
  });

  const handleTogglePencil = useCallback(() => {
    dismissCoachCard();
    resumeIfPaused();
    togglePencilMode();
  }, [dismissCoachCard, resumeIfPaused, togglePencilMode]);

  const background = useBoardBackgroundClear({ selectedIndex, selectCell, dismissCoachCard });

  return {
    lobbyOpen,
    setLobbyOpen,
    stickyDigit: sticky.stickyDigit,
    isBusy: isMovePending || isHintPending || isNotesPending || isUndoPending,
    isPencilMode,
    canUndo,
    handleTogglePencil,
    handleStickyDigit: sticky.handleStickyDigit,
    handlePaintNoteCell: sticky.handlePaintNoteCell,
    ...coach,
    ...controls,
    ...background,
  };
}
