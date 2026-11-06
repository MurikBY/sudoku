function formatNicknameHandle(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("display name is empty");
  }
  if (trimmed === "Player") {
    return "Player";
  }
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function formatByNickname(displayName: string): string {
  return `Game by ${formatNicknameHandle(displayName)}`;
}
