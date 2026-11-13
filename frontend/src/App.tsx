import { Suspense, useCallback, useReducer } from "react";

import { ActiveScreen } from "@/AppScreens";
import { Layout } from "@/components/Layout";
import { useGameSettings } from "@/hooks/useGameSettings";
import { usePlaySession } from "@/hooks/usePlaySession";
import { initialScreenState, screenReducer } from "@/hooks/screenState";
import { useStats } from "@/hooks/useStats";

function isTelegramWebApp(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}

function SecondaryScreenFallback() {
  return (
    <Layout bare>
      <p className="gazette-guide-paragraph">Loading…</p>
    </Layout>
  );
}

export default function App() {
  if (!isTelegramWebApp()) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Open this app from Telegram.
      </div>
    );
  }

  return <TelegramApp />;
}

function TelegramApp() {
  const [screen, dispatch] = useReducer(screenReducer, initialScreenState);
  const settings = useGameSettings();
  const stats = useStats();
  const { loadStats } = stats;
  const session = usePlaySession({
    screen,
    dispatch,
    difficulty: settings.difficulty,
    assists: settings.assists,
    setDifficulty: settings.setDifficulty,
    loadStats,
  });

  const openStats = useCallback(() => {
    dispatch({ type: "openStats" });
    void loadStats();
  }, [loadStats]);

  return (
    <Suspense fallback={<SecondaryScreenFallback />}>
      <ActiveScreen screen={screen} app={{ dispatch, settings, stats, session, openStats }} />
    </Suspense>
  );
}
