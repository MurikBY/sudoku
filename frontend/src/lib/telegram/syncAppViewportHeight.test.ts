import { describe, expect, it } from "vitest";

import { appViewportBox, type ViewportReading } from "@/lib/telegram/syncAppViewportHeight";

function reading(patch: Partial<ViewportReading> = {}): ViewportReading {
  return {
    stableHeight: 800,
    telegramHeight: 800,
    visualHeight: 800,
    visualOffsetTop: 0,
    innerHeight: 800,
    ...patch,
  };
}

describe("appViewportBox", () => {
  it("keeps the stable height when nothing covers it", () => {
    expect(appViewportBox(reading())).toEqual({ appHeight: 800, keyboardInset: 0 });
  });

  it("keeps the stable height and reports the keyboard from the visual viewport", () => {
    expect(appViewportBox(reading({ visualHeight: 470 }))).toEqual({
      appHeight: 800,
      keyboardInset: 330,
    });
  });

  it("reports the keyboard when only Telegram's current height shrinks", () => {
    expect(appViewportBox(reading({ telegramHeight: 500, visualHeight: null }))).toEqual({
      appHeight: 800,
      keyboardInset: 300,
    });
  });

  it("uses the larger covered strip", () => {
    expect(appViewportBox(reading({ telegramHeight: 640, visualHeight: 470 }))).toEqual({
      appHeight: 800,
      keyboardInset: 330,
    });
  });

  it("treats a scrolled visual viewport as already moved", () => {
    expect(appViewportBox(reading({ visualHeight: 470, visualOffsetTop: 330 }))).toEqual({
      appHeight: 800,
      keyboardInset: 0,
    });
  });

  it("falls back to the window height outside Telegram", () => {
    expect(
      appViewportBox(
        reading({
          stableHeight: null,
          telegramHeight: null,
          visualHeight: 700,
          innerHeight: 700,
        }),
      ),
    ).toEqual({ appHeight: 700, keyboardInset: 0 });
  });

  it("raises when no height is available", () => {
    expect(() =>
      appViewportBox(
        reading({
          stableHeight: null,
          telegramHeight: null,
          visualHeight: null,
          innerHeight: null,
        }),
      ),
    ).toThrow("viewport height is missing");
  });
});
