import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPreferences, savePreferences } from "@/api/users";
import type { Difficulty } from "@/api/types";
import {
  ASSIST_ROWS,
  loadGameSettings,
  saveGameSettings,
  toggleAssist,
  type AssistKey,
  type GameAssists,
  type GameSettings,
} from "@/lib/play/gameSettings";
import {
  isDefaultSettings,
  settingsFromPreferences,
  settingsToPreferences,
} from "@/lib/play/preferencesSync";

const SYNC_DEBOUNCE_MS = 400;

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(() => loadGameSettings());
  const [hydrated, setHydrated] = useState(false);
  const skipNextRemoteSyncRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      const localSettings = loadGameSettings();
      try {
        const remotePreferences = await fetchPreferences();
        if (cancelled) {
          return;
        }
        const remoteSettings = settingsFromPreferences(remotePreferences);
        if (isDefaultSettings(remoteSettings) && !isDefaultSettings(localSettings)) {
          await savePreferences(settingsToPreferences(localSettings));
          if (cancelled) {
            return;
          }
          skipNextRemoteSyncRef.current = true;
          setSettings(localSettings);
          saveGameSettings(localSettings);
        } else {
          skipNextRemoteSyncRef.current = true;
          setSettings(remoteSettings);
          saveGameSettings(remoteSettings);
        }
      } catch {
        if (!cancelled) {
          skipNextRemoteSyncRef.current = true;
          setSettings(localSettings);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return undefined;
    }
    saveGameSettings(settings);
    if (skipNextRemoteSyncRef.current) {
      skipNextRemoteSyncRef.current = false;
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      void savePreferences(settingsToPreferences(settings)).catch(() => {
        // cache stays local; next change retries
      });
    }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, settings]);

  const setDifficulty = useCallback((difficulty: Difficulty) => {
    setSettings((current) => ({ ...current, difficulty }));
  }, []);

  const setAssist = useCallback((key: AssistKey) => {
    setSettings((current) => ({
      ...current,
      assists: toggleAssist(current.assists, key),
    }));
  }, []);

  return {
    settings,
    assists: settings.assists as GameAssists,
    difficulty: settings.difficulty,
    assistRows: ASSIST_ROWS,
    hydrated,
    setDifficulty,
    setAssist,
  };
}
