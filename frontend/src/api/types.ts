import type { components } from "./schema";

type Schemas = components["schemas"];

export type Difficulty = Schemas["Difficulty"];

export type GameStatus = Schemas["GameStatus"];

export type Game = Schemas["GameResponse"];

export type CellNotesMap = Game["notes"];

export type CompletionRecap = Schemas["CompletionRecap"];

export type PartyAssists = Schemas["GameAssistsPayload"];

export type PartyMember = Schemas["PartyMemberResponse"];

export type Party = Schemas["PartyResponse"];

export type StartPartyResponse = Schemas["StartPartyResponse"];

export type PartyResultPlayer = Schemas["PartyResultPlayer"];

export type PartyProgress = Schemas["PartyProgressResponse"];

export type PartyResults = Schemas["PartyResultsResponse"];

export type GameEvent = Schemas["GameEvent"];

export type GameHistoryItem = Schemas["GameHistoryItem"];

export type GameHistoryResponse = Schemas["GameHistoryResponse"];

export type GameReview = Schemas["GameReviewResponse"];

export type MoveCellResponse = Schemas["MoveCellResponse"];

export type UndoMoveResponse = Schemas["UndoMoveResponse"];

export type HintResponse = Schemas["HintResponse"];

export type TaughtLessonSnapshot = Schemas["TaughtLessonSnapshotResponse"];

export type LessonProgressResponse = Schemas["LessonProgressResponse"];

export type DifficultyStats = Schemas["DifficultyStatsResponse"];

export type StatsPeriod = Schemas["StatsPeriod"];

export type UserStats = Schemas["UserStatsResponse"];

export type RatingDifficulty = Schemas["RatingDifficultyResponse"];

export type CleanBestLeaderboard = Schemas["CleanBestLeaderboardResponse"];

export type PartyWsEvent = Schemas["PartyWsEvent"];

export type PartyWsTicketResponse = Schemas["PartyWsTicketResponse"];
