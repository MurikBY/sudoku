import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASSISTS,
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  toggleAssist,
  type AssistKey,
  type GameAssists,
} from "@/lib/play/gameSettings";

const STORAGE_KEY = "sudoku.gameSettings.v3";

function installLocalStorage(raw: string | null) {
  const store = new Map<string, string>();
  if (raw !== null) {
    store.set(STORAGE_KEY, raw);
  }
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string): string | null {
        const value = store.get(key);
        if (value === undefined) {
          return null;
        }
        return value;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  });
}

function storedAssists(assists: Partial<GameAssists>, difficulty = "medium") {
  installLocalStorage(JSON.stringify({ difficulty, assists }));
  return loadGameSettings();
}

describe("loadGameSettings", () => {
  it("returns the default when nothing is stored", () => {
    installLocalStorage(null);
    expect(loadGameSettings()).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("returns the default when the difficulty is not a known level", () => {
    installLocalStorage(JSON.stringify({ difficulty: "nope", assists: DEFAULT_ASSISTS }));
    expect(loadGameSettings()).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("turns a missing sticky digit on when every stored assist is on", () => {
    const assists: Partial<GameAssists> = { ...DEFAULT_ASSISTS };
    delete assists.stickyDigit;
    expect(storedAssists(assists).assists.stickyDigit).toBe(true);
  });

  it("turns a missing sticky digit off when every stored assist is off", () => {
    const assists = Object.fromEntries(
      (Object.keys(DEFAULT_ASSISTS) as AssistKey[])
        .filter((key) => key !== "stickyDigit")
        .map((key) => [key, false]),
    );
    expect(storedAssists(assists).assists.stickyDigit).toBe(false);
  });

  it("uses the default sticky digit when the stored assists are mixed", () => {
    const assists: Partial<GameAssists> = { ...DEFAULT_ASSISTS, highlightPeers: false };
    delete assists.stickyDigit;
    const loaded = storedAssists(assists);
    expect(loaded.assists.stickyDigit).toBe(DEFAULT_ASSISTS.stickyDigit);
    expect(loaded.assists.highlightPeers).toBe(false);
    expect(loaded.assists.mistakeFeedback).toBe(true);
  });
});

describe("toggleAssist", () => {
  it("flips one key and leaves the others", () => {
    const next = toggleAssist(DEFAULT_ASSISTS, "mistakeFeedback");
    expect(next.mistakeFeedback).toBe(!DEFAULT_ASSISTS.mistakeFeedback);
    for (const key of Object.keys(DEFAULT_ASSISTS) as AssistKey[]) {
      if (key === "mistakeFeedback") {
        continue;
      }
      expect(next[key]).toBe(DEFAULT_ASSISTS[key]);
    }
  });
});
