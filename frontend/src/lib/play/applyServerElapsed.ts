export function applyServerElapsed(
  result: { elapsed_seconds: number } | null,
  setElapsedFromServer: (elapsedSeconds: number) => void,
): void {
  if (result === null) {
    return;
  }
  setElapsedFromServer(result.elapsed_seconds);
}
