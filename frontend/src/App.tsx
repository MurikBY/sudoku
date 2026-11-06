import { lazy, Suspense, useCallback, useReducer } from "react";

import { Layout } from "@/components/Layout";
import { PartyLobbyModal } from "@/components/PartyLobbyModal";
import { useGameSettings } from "@/hooks/useGameSettings";
import { usePlaySession } from "@/hooks/usePlaySession";
import { initialScreenState, screenReducer } from "@/hooks/screenState";
import { useStats } from "@/hooks/useStats";
import { playModeFromScreen } from "@/lib/play/playMode";
import { HomePage } from "@/pages/HomePage";
import { PlayPage } from "@/pages/PlayPage";

const AssistsPage = lazy(() =>
  import("@/pages/AssistsPage").then((module) => ({ default: module.AssistsPage })),
);
const GameReviewPage = lazy(() =>
  import("@/pages/GameReviewPage").then((module) => ({ default: module.GameReviewPage })),
);
const InfoPage = lazy(() =>
  import("@/pages/InfoPage").then((module) => ({ default: module.InfoPage })),
);
const LearnPage = lazy(() =>
  import("@/pages/LearnPage").then((module) => ({ default: module.LearnPage })),
);
const RatingPage = lazy(() =>
  import("@/pages/RatingPage").then((module) => ({ default: module.RatingPage })),
);
const StatsPage = lazy(() =>
  import("@/pages/StatsPage").then((module) => ({ default: module.StatsPage })),
);

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
  const { difficulty, assists, assistRows, setDifficulty, setAssist } = useGameSettings();
  const {
    stats,
    period: statsPeriod,
    loading: statsLoading,
    error: statsError,
    reconnecting: statsReconnecting,
    loadStats,
  } = useStats();
  const { home, lobby, review, analysis, lesson, leave } = usePlaySession({
    screen,
    dispatch,
    difficulty,
    assists,
    setDifficulty,
    loadStats,
  });

  const handleOpenStats = useCallback(() => {
    dispatch({ type: "openStats" });
    void loadStats();
  }, [loadStats]);

  function activeScreen() {
    switch (screen.name) {
      case "home":
        return (
          <Layout bare>
            <HomePage
              difficulty={difficulty}
              home={home}
              onDifficultyChange={setDifficulty}
              onOpenResults={handleOpenStats}
              onOpenRating={leave.rating}
              onOpenSettings={() => dispatch({ type: "openSettings" })}
              onOpenLearn={() => dispatch({ type: "openLearn" })}
              onOpenGuide={() => dispatch({ type: "openGuide", rubricId: null })}
            />
            <PartyLobbyModal lobby={lobby} />
          </Layout>
        );
      case "review":
        return (
          <Layout bare>
            <GameReviewPage
              review={screen.review}
              onBack={review.back}
              onOpenParty={review.openParty}
              onPlayFromHere={analysis.playFromHere}
              playFromHereBusy={analysis.busy}
              playFromHereError={analysis.error}
            />
          </Layout>
        );
      case "stats":
        return (
          <Layout bare>
            <StatsPage
              stats={stats}
              period={statsPeriod}
              loading={statsLoading}
              error={statsError}
              reconnecting={statsReconnecting}
              onPeriodChange={(period) => void loadStats(period)}
              onGoHome={leave.home}
              onPlayDataReset={() => {
                dispatch({ type: "clearStatsParty" });
                void loadStats();
                void home.refreshResumable();
              }}
              initialMode={screen.mode}
              initialPartyId={screen.partyId}
              onPartyDetailClosed={() => dispatch({ type: "clearStatsParty" })}
              onOpenReview={review.open}
            />
          </Layout>
        );
      case "rating":
        return (
          <Layout bare>
            <RatingPage onGoHome={leave.home} />
          </Layout>
        );
      case "info":
        return (
          <Layout bare>
            <InfoPage
              onGoHome={leave.home}
              rubricId={screen.rubricId}
              onRubricIdChange={(rubricId) => dispatch({ type: "setGuideRubric", rubricId })}
              onOpenLearn={() => dispatch({ type: "openLearn" })}
            />
          </Layout>
        );
      case "learn":
        return (
          <Layout bare>
            <LearnPage
              onGoHome={leave.home}
              articleId={screen.articleId}
              onArticleIdChange={(articleId) => dispatch({ type: "setLearnArticle", articleId })}
              onPracticeThis={(technique) => lesson.start(technique, "practice")}
              practiceBusy={lesson.busy}
              practiceError={lesson.error}
            />
          </Layout>
        );
      case "settings":
        return (
          <Layout bare>
            <AssistsPage
              assists={assists}
              assistRows={assistRows}
              onAssistToggle={setAssist}
              onOpenGuideAssists={() => dispatch({ type: "openGuide", rubricId: "assists" })}
              onGoHome={leave.home}
            />
          </Layout>
        );
      case "play":
        return (
          <Layout bare>
            <PlayPage
              key={screen.game.id}
              initialGame={screen.game}
              assists={screen.assists}
              isPaused={screen.paused}
              onResume={() => dispatch({ type: "setPaused", paused: false })}
              onTogglePause={() => dispatch({ type: "setPaused", paused: !screen.paused })}
              onLeaveToHome={leave.home}
              onStatsRefresh={() => void loadStats()}
              onOpenRating={leave.rating}
              onOpenPartyResults={review.openParty}
              mode={playModeFromScreen(screen, {
                onAnalysisSolved: analysis.onSolved,
                onBackToReview: analysis.backToReview,
                onBackToGuide: lesson.back,
                onStartPractice: (technique, excludePositionId) => {
                  lesson.start(technique, "practice", excludePositionId);
                },
                practiceBusy: lesson.busy,
                practiceError: lesson.error,
              })}
            />
          </Layout>
        );
    }
  }

  return <Suspense fallback={<SecondaryScreenFallback />}>{activeScreen()}</Suspense>;
}
