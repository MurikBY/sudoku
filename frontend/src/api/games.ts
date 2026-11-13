import { api, readEmpty, readJson } from "@/api/client";
import type {
  Difficulty,
  Game,
  GameHistoryResponse,
  GameReview,
  GameStatus,
  HintResponse,
  LessonProgressResponse,
  MoveCellResponse,
  TaughtLessonSnapshot,
  UndoMoveResponse,
} from "@/api/types";
import type { PuzzleExport } from "@/lib/play/exportPuzzle";

function withElapsedSeconds(elapsedSeconds: number | undefined): { elapsed_seconds?: number } {
  if (elapsedSeconds === undefined) {
    return {};
  }
  return { elapsed_seconds: elapsedSeconds };
}

export function fetchResumableGame(): Promise<Game | null> {
  return readJson(api.GET("/api/games/resumable"));
}

export function createGame(difficulty: Difficulty): Promise<Game> {
  return readJson(api.POST("/api/games", { body: { difficulty } }));
}

export function fetchGame(gameId: string): Promise<Game> {
  return readJson(
    api.GET("/api/games/{game_id}", {
      params: { path: { game_id: gameId } },
    }),
  );
}

export function fetchGameHistory(
  limit = 40,
  offset = 0,
  filters: {
    difficulty?: Difficulty;
    status?: GameStatus;
  } = {},
): Promise<GameHistoryResponse> {
  return readJson(
    api.GET("/api/games/history", {
      params: {
        query: {
          limit,
          offset,
          difficulty: filters.difficulty,
          status: filters.status,
        },
      },
    }),
  );
}

export function fetchGameReview(gameId: string): Promise<GameReview> {
  return readJson(
    api.GET("/api/games/{game_id}/review", {
      params: { path: { game_id: gameId } },
    }),
  );
}

export function fetchGameReviewByCode(code: string): Promise<GameReview> {
  return readJson(
    api.GET("/api/games/by-code/{code}", {
      params: { path: { code: code.trim().toUpperCase() } },
    }),
  );
}

export function sendPuzzleExportToChat(payload: PuzzleExport): Promise<void> {
  return readEmpty(api.POST("/api/games/export-to-chat", { body: payload }));
}

export function createAnalysisGame(shareCode: string, eventIndex: number): Promise<Game> {
  return readJson(
    api.POST("/api/games/analysis", {
      body: {
        share_code: shareCode.trim().toUpperCase(),
        event_index: eventIndex,
      },
    }),
  );
}

export function createLessonGame(
  technique: string,
  variant: "taught" | "practice",
  excludePositionId?: string,
): Promise<Game> {
  return readJson(
    api.POST("/api/games/lessons", {
      body: {
        technique,
        variant,
        ...(excludePositionId === undefined ? {} : { exclude_position_id: excludePositionId }),
      },
    }),
  );
}

export function fetchTaughtLessonSnapshot(technique: string): Promise<TaughtLessonSnapshot> {
  return readJson(
    api.GET("/api/games/lessons/{technique}", {
      params: { path: { technique } },
    }),
  );
}

export function fetchLessonProgress(): Promise<LessonProgressResponse> {
  return readJson(api.GET("/api/games/lesson-progress"));
}

// keepalive lets the sync sent while the page hides or closes still arrive.
export function syncGameProgress(gameId: string, elapsedSeconds: number): Promise<void> {
  return readEmpty(
    api.PATCH("/api/games/{game_id}", {
      params: { path: { game_id: gameId } },
      body: { elapsed_seconds: elapsedSeconds },
      keepalive: true,
    }),
  );
}

export function moveCell(
  gameId: string,
  index: number,
  value: number,
  elapsedSeconds?: number,
): Promise<MoveCellResponse> {
  return readJson(
    api.PUT("/api/games/{game_id}/cells/{index}", {
      params: { path: { game_id: gameId, index } },
      body: { value, ...withElapsedSeconds(elapsedSeconds) },
    }),
  );
}

export function completeGame(gameId: string, elapsedSeconds: number): Promise<Game> {
  return readJson(
    api.POST("/api/games/{game_id}/complete", {
      params: { path: { game_id: gameId } },
      body: { elapsed_seconds: elapsedSeconds },
    }),
  );
}

export function abandonGame(gameId: string, elapsedSeconds: number): Promise<Game> {
  return readJson(
    api.POST("/api/games/{game_id}/abandon", {
      params: { path: { game_id: gameId } },
      body: { elapsed_seconds: elapsedSeconds },
    }),
  );
}

export function requestHint(gameId: string, elapsedSeconds?: number): Promise<HintResponse> {
  return readJson(
    api.POST("/api/games/{game_id}/hint", {
      params: { path: { game_id: gameId } },
      body: withElapsedSeconds(elapsedSeconds),
    }),
  );
}

export function setCellNotes(
  gameId: string,
  index: number,
  digits: number[],
  elapsedSeconds?: number,
): Promise<Game> {
  return readJson(
    api.PUT("/api/games/{game_id}/cells/{index}/notes", {
      params: { path: { game_id: gameId, index } },
      body: { digits, ...withElapsedSeconds(elapsedSeconds) },
    }),
  );
}

export function undoLastMove(gameId: string, elapsedSeconds?: number): Promise<UndoMoveResponse> {
  return readJson(
    api.POST("/api/games/{game_id}/undo", {
      params: { path: { game_id: gameId } },
      body: withElapsedSeconds(elapsedSeconds),
    }),
  );
}
