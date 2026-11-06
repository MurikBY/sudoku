export function formatElapsedSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatOptionalElapsedSeconds(seconds: number | null): string {
  if (seconds === null) {
    return "–";
  }
  return formatElapsedSeconds(seconds);
}
