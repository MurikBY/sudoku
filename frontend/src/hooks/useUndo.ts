import { useCallback, type Dispatch, type RefObject } from "react";

import { undoLastMove as postUndoLastMove } from "@/api/games";
import type { Game } from "@/api/types";
import type { BoardAction } from "@/hooks/boardState";
import { formatApiErrorMessage } from "@/lib/api/apiError";

type EnqueueBoardAction = <T>(action: () => Promise<T>) => Promise<T>;

type UseUndoArgs = {
  enqueueBoardAction: EnqueueBoardAction;
  gameRef: RefObject<Game>;
  dispatch: Dispatch<BoardAction>;
  flashCells: (cells: readonly number[]) => void;
  setUndoPending: (pending: boolean) => void;
};

export function useUndo({
  enqueueBoardAction,
  gameRef,
  dispatch,
  flashCells,
  setUndoPending,
}: UseUndoArgs) {
  const undoLastMove = useCallback(
    (elapsedSeconds: number) =>
      enqueueBoardAction(async () => {
        const currentGame = gameRef.current;
        if (currentGame.undo_count <= 0 || currentGame.status !== "in_progress") {
          return null;
        }
        setUndoPending(true);
        dispatch({ type: "clearError" });
        try {
          const undoResult = await postUndoLastMove(currentGame.id, elapsedSeconds);
          gameRef.current = undoResult;
          dispatch({ type: "replaceGame", game: undoResult });
          dispatch({ type: "setSelectedIndex", index: undoResult.undone_cell_index });
          flashCells(undoResult.flashed_cell_indices);
          return undoResult;
        } catch (undoError) {
          dispatch({ type: "setError", error: formatApiErrorMessage(undoError) });
          return null;
        } finally {
          setUndoPending(false);
        }
      }),
    [dispatch, enqueueBoardAction, flashCells, gameRef, setUndoPending],
  );

  return { undoLastMove };
}
