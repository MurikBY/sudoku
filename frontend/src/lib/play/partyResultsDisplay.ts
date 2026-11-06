import type { GameStatus, PartyResultPlayer } from "@/api/types";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";

export function partyPlayerTimeLabel(player: PartyResultPlayer): string {
  if (player.status === "abandoned") {
    return "Left";
  }
  if (player.status === "completed" && typeof player.elapsed_seconds === "number") {
    return formatElapsedSeconds(player.elapsed_seconds);
  }
  return "–";
}

export function partyPlayerStatLabel(
  player: PartyResultPlayer,
  field: "mistakes_count" | "hints_count" | "pencil_count",
): string {
  const value = player[field];
  if (player.status !== "completed" || value === null || value === undefined) {
    return "–";
  }
  return String(value);
}

export function partyHasOpenPlayers(players: ReadonlyArray<{ status: GameStatus }>): boolean {
  return players.some((player) => player.status === "in_progress");
}
