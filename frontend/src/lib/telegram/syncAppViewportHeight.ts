export type ViewportReading = {
  stableHeight: number | null;
  telegramHeight: number | null;
  visualHeight: number | null;
  visualOffsetTop: number;
  innerHeight: number | null;
};

export function appViewportBox(reading: ViewportReading): {
  appHeight: number;
  keyboardInset: number;
} {
  const stable = firstPositive(reading.stableHeight, reading.innerHeight);
  if (stable === null) {
    throw new Error("viewport height is missing");
  }
  const coveredByVisual =
    reading.visualHeight === null ? 0 : stable - reading.visualHeight - reading.visualOffsetTop;
  const coveredByTelegram = reading.telegramHeight === null ? 0 : stable - reading.telegramHeight;
  return {
    appHeight: Math.round(stable),
    keyboardInset: Math.max(0, Math.round(Math.max(coveredByVisual, coveredByTelegram))),
  };
}

export function syncAppViewportHeight(): () => void {
  const root = document.documentElement;

  const apply = () => {
    const box = appViewportBox(readViewport());
    // Stable height, not the area left above the keyboard. The covered strip is --keyboard-inset.
    root.style.setProperty("--app-vh", `${box.appHeight}px`);
    root.style.setProperty("--keyboard-inset", `${box.keyboardInset}px`);
  };

  apply();

  const telegramWebApp = window.Telegram?.WebApp;
  telegramWebApp?.onEvent?.("viewportChanged", apply);
  window.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("scroll", apply);

  return () => {
    telegramWebApp?.offEvent?.("viewportChanged", apply);
    window.removeEventListener("resize", apply);
    window.visualViewport?.removeEventListener("resize", apply);
    window.visualViewport?.removeEventListener("scroll", apply);
  };
}

function readViewport(): ViewportReading {
  const telegramWebApp = window.Telegram?.WebApp;
  const visual = window.visualViewport;
  return {
    stableHeight: positiveOrNull(telegramWebApp?.viewportStableHeight),
    telegramHeight: positiveOrNull(telegramWebApp?.viewportHeight),
    visualHeight: positiveOrNull(visual?.height),
    visualOffsetTop: offsetOrZero(visual?.offsetTop),
    innerHeight: positiveOrNull(window.innerHeight),
  };
}

function firstPositive(primary: number | null, fallback: number | null): number | null {
  if (primary !== null) {
    return primary;
  }
  return fallback;
}

function positiveOrNull(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function offsetOrZero(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}
