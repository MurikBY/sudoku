import { api, readEmpty, readJson } from "@/api/client";
import type { CleanBestLeaderboard, StatsPeriod, UserStats } from "@/api/types";
import type { UserPreferences } from "@/lib/play/preferencesSync";

export function fetchStats(period: StatsPeriod = "all"): Promise<UserStats> {
  if (period === "all") {
    return readJson(api.GET("/api/stats"));
  }
  return readJson(api.GET("/api/stats", { params: { query: { period } } }));
}

export function fetchCleanBestRating(): Promise<CleanBestLeaderboard> {
  return readJson(api.GET("/api/stats/rating"));
}

export function fetchPreferences(): Promise<UserPreferences> {
  return readJson(api.GET("/api/users/me/preferences"));
}

export function savePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  return readJson(api.PUT("/api/users/me/preferences", { body: preferences }));
}

export function resetPlayData(): Promise<void> {
  return readEmpty(api.POST("/api/users/me/reset-play-data"));
}
