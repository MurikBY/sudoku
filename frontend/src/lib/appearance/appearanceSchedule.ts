export const APPEARANCE_STORAGE_KEY = "sudoku.appearance.v1";

export const AUTO_DARK_START_HOUR = 18;

export const AUTO_DARK_END_HOUR = 8;

export function isAutoDarkHour(hour: number): boolean {
  return hour >= AUTO_DARK_START_HOUR || hour < AUTO_DARK_END_HOUR;
}
