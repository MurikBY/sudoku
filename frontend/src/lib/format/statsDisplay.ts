export function winRatePercentValue(winRate: number | null): number | null {
  if (winRate === null) {
    return null;
  }
  return Math.round(winRate * 100);
}

export function formatOptionalAverage(value: number | null): string {
  if (value === null) {
    return "–";
  }
  if (value > 5) {
    return String(Math.round(value));
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
