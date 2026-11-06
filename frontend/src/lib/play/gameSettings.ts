import type { Difficulty } from "@/api/types";

export type GameAssists = {
  highlightPeers: boolean;
  highlightSameDigit: boolean;
  mistakeFeedback: boolean;
  dimCompletedDigits: boolean;
  unitCompleteAnimation: boolean;
  autoClearNotes: boolean;
  stickyDigit: boolean;
};

export type GameSettings = {
  difficulty: Difficulty;
  assists: GameAssists;
};

export type AssistKey = keyof GameAssists;

export const DEFAULT_ASSISTS: GameAssists = {
  highlightPeers: true,
  highlightSameDigit: true,
  mistakeFeedback: true,
  dimCompletedDigits: true,
  unitCompleteAnimation: true,
  autoClearNotes: true,
  stickyDigit: true,
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  difficulty: "medium",
  assists: { ...DEFAULT_ASSISTS },
};

export const ASSIST_ROWS: { key: AssistKey; label: string }[] = [
  { key: "highlightPeers", label: "Highlight row / column / box" },
  { key: "highlightSameDigit", label: "Highlight same digit" },
  { key: "mistakeFeedback", label: "Highlight mistakes" },
  { key: "dimCompletedDigits", label: "Dim completed digits" },
  { key: "unitCompleteAnimation", label: "Flash completed r/c/b" },
  { key: "autoClearNotes", label: "Auto-clear notes" },
  { key: "stickyDigit", label: "Long-press to lock digit" },
];

const STORAGE_KEY = "sudoku.gameSettings.v3";

export function toggleAssist(assists: GameAssists, key: AssistKey): GameAssists {
  return { ...assists, [key]: !assists[key] };
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

function normalizeAssists(value: unknown): GameAssists | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const knownKeys = Object.keys(DEFAULT_ASSISTS) as AssistKey[];
  const presentKeys = knownKeys.filter((key) => key in record);
  if (presentKeys.length === 0) {
    return null;
  }
  for (const key of presentKeys) {
    if (typeof record[key] !== "boolean") {
      return null;
    }
  }
  const allPresentOn = presentKeys.every((key) => record[key] === true);
  const allPresentOff = presentKeys.every((key) => record[key] === false);
  const assists = { ...DEFAULT_ASSISTS };
  for (const key of knownKeys) {
    if (key in record) {
      assists[key] = record[key] as boolean;
      continue;
    }
    if (allPresentOff) {
      assists[key] = false;
    } else if (allPresentOn) {
      assists[key] = true;
    } else {
      assists[key] = DEFAULT_ASSISTS[key];
    }
  }
  return assists;
}

function copyAssists(assists: GameAssists): GameAssists {
  return {
    highlightPeers: assists.highlightPeers,
    highlightSameDigit: assists.highlightSameDigit,
    mistakeFeedback: assists.mistakeFeedback,
    dimCompletedDigits: assists.dimCompletedDigits,
    unitCompleteAnimation: assists.unitCompleteAnimation,
    autoClearNotes: assists.autoClearNotes,
    stickyDigit: assists.stickyDigit,
  };
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_GAME_SETTINGS,
        assists: { ...DEFAULT_ASSISTS },
      };
    }
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    if (!isDifficulty(parsed.difficulty)) {
      throw new Error("invalid game settings");
    }
    const assists = normalizeAssists(parsed.assists);
    if (assists === null) {
      throw new Error("invalid game settings");
    }
    return {
      difficulty: parsed.difficulty,
      assists: copyAssists(assists),
    };
  } catch {
    // localStorage can be unavailable, and a stored value can be unreadable or invalid.
    return {
      ...DEFAULT_GAME_SETTINGS,
      assists: { ...DEFAULT_ASSISTS },
    };
  }
}

export function saveGameSettings(settings: GameSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
