export function formatPartyStartedAt(startedAtIso: string): string {
  const startedAt = new Date(startedAtIso);
  if (Number.isNaN(startedAt.getTime())) {
    throw new Error(`invalid party started_at: ${startedAtIso}`);
  }
  const datePart = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(startedAt);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(startedAt);
  return `${datePart} at ${timePart}`;
}

export function formatPartyLobbyName(code: string, startedAtIso: string): string {
  return `${code} · ${formatPartyStartedAt(startedAtIso)}`;
}
