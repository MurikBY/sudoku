import { useCallback, type Dispatch, type RefObject } from "react";

import { setCellNotes } from "@/api/games";
import type { CellNotesMap, Game } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { notesWithCellDigits } from "@/lib/play/boardNotes";
import {
  addNoteDigit,
  cellDigitValue,
  isGivenCell,
  notesForCell,
  toggleNoteDigit,
} from "@/lib/play/sudokuGrid";

type EnqueueBoardAction = <T>(action: () => Promise<T>) => Promise<T>;

type NotesStore = {
  gameRef: RefObject<Game>;
  storeGame: (game: Game) => void;
  dispatch: Dispatch<BoardAction>;
};

function notesWithoutPaintedDigit(
  notes: CellNotesMap,
  cellIndex: number,
  digit: number,
): CellNotesMap {
  const remaining = notesForCell(notes, cellIndex).filter((value) => value !== digit);
  return notesWithCellDigits(notes, cellIndex, remaining);
}

function isNotesEditableCell(game: Game, cellIndex: number | null): cellIndex is number {
  return (
    cellIndex !== null &&
    game.status === "in_progress" &&
    !isGivenCell(game.puzzle, cellIndex) &&
    cellDigitValue(game.current_grid, cellIndex) === null
  );
}

function sameDigits(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

// Runs on the queue after the optimistic paint. The answer is merged into the latest notes,
// because later paints may already be on screen; a failure removes only this digit.
async function sendPaintedNote(
  store: NotesStore,
  cellIndex: number,
  digit: number,
  elapsedSeconds: number,
) {
  const queuedGame = store.gameRef.current;
  const digitsToSend = addNoteDigit(notesForCell(queuedGame.notes, cellIndex), digit);
  store.dispatch({ type: "clearError" });
  try {
    const updatedGame = await setCellNotes(queuedGame.id, cellIndex, digitsToSend, elapsedSeconds);
    const mergedGame = {
      ...updatedGame,
      notes: notesWithCellDigits(
        store.gameRef.current.notes,
        cellIndex,
        notesForCell(updatedGame.notes, cellIndex),
      ),
    };
    store.storeGame(mergedGame);
    return mergedGame;
  } catch (notesError) {
    const latestGame = store.gameRef.current;
    store.storeGame({
      ...latestGame,
      notes: notesWithoutPaintedDigit(latestGame.notes, cellIndex, digit),
    });
    store.dispatch({ type: "setError", error: formatApiErrorMessage(notesError) });
    return null;
  }
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
  const storeGame = useCallback(
    (game: Game) => {
      gameRef.current = game;
      dispatch({ type: "storeGame", game });
    },
    [dispatch, gameRef],
  );

  const sendCellNotes = useCallback(
    (
      digitsFor: (game: Game, cellIndex: number) => number[],
      elapsedSeconds: number,
      cellIndexOverride?: number,
    ) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        const cellIndex = cellIndexOverride ?? selectedIndexRef.current;
        if (!isNotesEditableCell(currentGame, cellIndex)) {
          return null;
        }
        const digits = digitsFor(currentGame, cellIndex);
        dispatch({ type: "clearError" });
        try {
          const updatedGame = await setCellNotes(currentGame.id, cellIndex, digits, elapsedSeconds);
          storeGame(updatedGame);
          return updatedGame;
        } catch (notesError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(notesError) });
          return null;
        }
      }),
    [dispatch, enqueueBoardAction, gameRef, selectedIndexRef, storeGame],
  );

  const toggleNote = useCallback(
    (digit: number, elapsedSeconds: number, cellIndexOverride?: number) =>
      sendCellNotes(
        (game, cellIndex) => toggleNoteDigit(notesForCell(game.notes, cellIndex), digit),
        elapsedSeconds,
        cellIndexOverride,
      ),
    [sendCellNotes],
  );

  const addNote = useCallback(
    (digit: number, elapsedSeconds: number, cellIndex: number) => {
      const currentGame = gameRef.current;
      if (!isNotesEditableCell(currentGame, cellIndex)) {
        return Promise.resolve(null);
      }
      const previousDigits = notesForCell(currentGame.notes, cellIndex);
      const nextDigits = addNoteDigit(previousDigits, digit);
      if (sameDigits(previousDigits, nextDigits)) {
        return Promise.resolve(currentGame);
      }
      storeGame({
        ...currentGame,
        notes: notesWithCellDigits(currentGame.notes, cellIndex, nextDigits),
      });
      const store = { gameRef, storeGame, dispatch };
      return enqueueBoardAction(() => sendPaintedNote(store, cellIndex, digit, elapsedSeconds));
    },
    [dispatch, enqueueBoardAction, gameRef, storeGame],
  );

  const clearNotes = useCallback(
    async (elapsedSeconds: number) => sendCellNotes(() => [], elapsedSeconds),
    [sendCellNotes],
  );

  return { toggleNote, addNote, clearNotes };
}
