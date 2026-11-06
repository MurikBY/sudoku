import { APPEARANCE_STORAGE_KEY, isAutoDarkHour } from "@/lib/appearance/appearanceSchedule";

export type AppearanceTheme = "light" | "auto" | "dark";
type ResolvedAppearance = "light" | "dark";

export function loadAppearanceTheme(): AppearanceTheme {
  const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (raw === null) {
    return "auto";
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || !("theme" in parsed)) {
    throw new Error("appearance storage missing theme");
  }
  const theme = parsed.theme;
  if (theme !== "light" && theme !== "auto" && theme !== "dark") {
    throw new Error(`invalid appearance theme: ${String(theme)}`);
  }
  return theme;
}

export function saveAppearanceTheme(theme: AppearanceTheme): void {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ theme }));
}

function resolvedAppearance(theme: AppearanceTheme, at: Date): ResolvedAppearance {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  if (isAutoDarkHour(at.getHours())) {
    return "dark";
  }
  return "light";
}

export function applyAppearanceTheme(theme: AppearanceTheme): void {
  const resolved = resolvedAppearance(theme, new Date());
  document.documentElement.classList.toggle("dark", resolved === "dark");
  const background = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim();
  if (!background) {
    throw new Error("missing --background after applying appearance");
  }
  const telegram = window.Telegram?.WebApp;
  telegram?.setBackgroundColor?.(background);
  telegram?.setHeaderColor?.(background);
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor === null) {
    throw new Error("missing theme-color meta");
  }
  themeColor.setAttribute("content", background);
}

export function applyStoredAppearance(): void {
  applyAppearanceTheme(loadAppearanceTheme());
}
