import { useCallback, type Dispatch, type RefObject } from "react";

import { setCellNotes } from "@/api/games";
import type { CellNotesMap, Game } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { mergedCellNotes, notesWithCellDigits } from "@/lib/play/boardNotes";
import {
  addNoteDigit,
  cellDigitValue,
  isGivenCell,
  notesForCell,
  toggleNoteDigit,
} from "@/lib/play/sudokuGrid";

type EnqueueBoardAction = <T>(action: () => Promise<T>) => Promise<T>;

function notesWithoutPaintedDigit(
  notes: CellNotesMap,
  cellIndex: number,
  digit: number,
): CellNotesMap {
  const remaining = notesForCell(notes, cellIndex).filter((value) => value !== digit);
  return notesWithCellDigits(notes, cellIndex, remaining);
}

type UseNotesArgs = {
  enqueueBoardAction: EnqueueBoardAction;
  gameRef: RefObject<Game>;
  selectedIndexRef: RefObject<number | null>;
  dispatch: Dispatch<BoardAction>;
};

export function useNotes({
  enqueueBoardAction,
  gameRef,
  selectedIndexRef,
  dispatch,
}: UseNotesArgs) {
  const applyNotesDigits = useCallback(
    (digits: number[], elapsedSeconds: number, cellIndexOverride?: number) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        const targetIndex = cellIndexOverride ?? selectedIndexRef.current;
        if (targetIndex === null || currentGame.status !== "in_progress") {
          return null;
        }
        if (isGivenCell(currentGame.puzzle, targetIndex)) {
          return null;
        }
        if (cellDigitValue(currentGame.current_grid, targetIndex) !== null) {
          return null;
        }

        const cellIndex = targetIndex;

        dispatch({ type: "clearError" });
        try {
          const updatedGame = await setCellNotes(currentGame.id, cellIndex, digits, elapsedSeconds);
          gameRef.current = updatedGame;
          dispatch({ type: "storeGame", game: updatedGame });
          return updatedGame;
        } catch (notesError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(notesError) });
          return null;
        }
      }),
    [dispatch, enqueueBoardAction, gameRef, selectedIndexRef],
  );

  const toggleNote = useCallback(
    (digit: number, elapsedSeconds: number, cellIndexOverride?: number) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        const targetIndex = cellIndexOverride ?? selectedIndexRef.current;
        if (targetIndex === null || currentGame.status !== "in_progress") {
          return null;
        }
        if (isGivenCell(currentGame.puzzle, targetIndex)) {
          return null;
        }
        if (cellDigitValue(currentGame.current_grid, targetIndex) !== null) {
          return null;
        }

        const cellIndex = targetIndex;
        const previousDigits = notesForCell(currentGame.notes, cellIndex);
        const nextDigits = toggleNoteDigit(previousDigits, digit);

        dispatch({ type: "clearError" });
        try {
          const updatedGame = await setCellNotes(
            currentGame.id,
            cellIndex,
            nextDigits,
            elapsedSeconds,
          );
          gameRef.current = updatedGame;
          dispatch({ type: "storeGame", game: updatedGame });
          return updatedGame;
        } catch (notesError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(notesError) });
          return null;
        }
      }),
    [dispatch, enqueueBoardAction, gameRef, selectedIndexRef],
  );

  const addNote = useCallback(
    (digit: number, elapsedSeconds: number, cellIndex: number) => {
      const currentGame = gameRef.current;
      if (currentGame.status !== "in_progress") {
        return Promise.resolve(null);
      }
      if (isGivenCell(currentGame.puzzle, cellIndex)) {
        return Promise.resolve(null);
      }
      if (cellDigitValue(currentGame.current_grid, cellIndex) !== null) {
        return Promise.resolve(null);
      }

      const previousDigits = notesForCell(currentGame.notes, cellIndex);
      const nextDigits = addNoteDigit(previousDigits, digit);
      if (
        previousDigits.length === nextDigits.length &&
        previousDigits.every((value, index) => value === nextDigits[index])
      ) {
        return Promise.resolve(currentGame);
      }

      const optimisticGame = {
        ...currentGame,
        notes: notesWithCellDigits(currentGame.notes, cellIndex, nextDigits),
      };
      gameRef.current = optimisticGame;
      dispatch({ type: "storeGame", game: optimisticGame });

      return enqueueBoardAction(async () => {
        const queuedGame = gameRef.current;
        const digitsToSend = addNoteDigit(notesForCell(queuedGame.notes, cellIndex), digit);

        dispatch({ type: "clearError" });
        try {
          const updatedGame = await setCellNotes(
            queuedGame.id,
            cellIndex,
            digitsToSend,
            elapsedSeconds,
          );
          const mergedGame = {
            ...updatedGame,
            notes: mergedCellNotes(
              gameRef.current.notes,
              cellIndex,
              updatedGame.notes[String(cellIndex)] ?? digitsToSend,
            ),
          };
          gameRef.current = mergedGame;
          dispatch({ type: "storeGame", game: mergedGame });
          return mergedGame;
        } catch (notesError) {
          const latestGame = gameRef.current;
          const revertedGame = {
            ...latestGame,
            notes: notesWithoutPaintedDigit(latestGame.notes, cellIndex, digit),
          };
          gameRef.current = revertedGame;
          dispatch({ type: "storeGame", game: revertedGame });
          dispatch({ type: "setError", error: formatApiErrorMessage(notesError) });
          return null;
        }
      });
    },
    [dispatch, enqueueBoardAction, gameRef],
  );

  const clearNotes = useCallback(
    async (elapsedSeconds: number) => applyNotesDigits([], elapsedSeconds),
    [applyNotesDigits],
  );

  return { applyNotesDigits, toggleNote, addNote, clearNotes };
}
