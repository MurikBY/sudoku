import { lazy, type Dispatch } from "react";

import { Layout } from "@/components/Layout";
import { PartyLobbyModal } from "@/components/PartyLobbyModal";
import type { PlaySession } from "@/hooks/playSessionTypes";
import type { ScreenAction, ScreenState } from "@/hooks/screenState";
import type { useGameSettings } from "@/hooks/useGameSettings";
import type { useStats } from "@/hooks/useStats";
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

export type AppScreenContext = {
  dispatch: Dispatch<ScreenAction>;
  settings: ReturnType<typeof useGameSettings>;
  stats: ReturnType<typeof useStats>;
  session: PlaySession;
  openStats: () => void;
};

type ScreenOf<Name extends ScreenState["name"]> = Extract<ScreenState, { name: Name }>;

function HomeScreen({ app }: { app: AppScreenContext }) {
  const { dispatch, session } = app;
  return (
    <>
      <HomePage
        difficulty={app.settings.difficulty}
        home={session.home}
        onDifficultyChange={app.settings.setDifficulty}
        onOpenResults={app.openStats}
        onOpenRating={session.leave.rating}
        onOpenSettings={() => dispatch({ type: "openSettings" })}
        onOpenLearn={() => dispatch({ type: "openLearn" })}
        onOpenGuide={() => dispatch({ type: "openGuide", rubricId: null })}
      />
      <PartyLobbyModal lobby={session.lobby} />
    </>
  );
}

function ReviewScreen({ screen, app }: { screen: ScreenOf<"review">; app: AppScreenContext }) {
  const { review, analysis } = app.session;
  return (
    <GameReviewPage
      review={screen.review}
      onBack={review.back}
      onOpenParty={review.openParty}
      onPlayFromHere={analysis.playFromHere}
      playFromHereBusy={analysis.busy}
      playFromHereError={analysis.error}
    />
  );
}

function StatsScreen({ screen, app }: { screen: ScreenOf<"stats">; app: AppScreenContext }) {
  const { dispatch, stats, session } = app;
  return (
    <StatsPage
      stats={stats.stats}
      period={stats.period}
      loading={stats.loading}
      error={stats.error}
      reconnecting={stats.reconnecting}
      onPeriodChange={(period) => void stats.loadStats(period)}
      onGoHome={session.leave.home}
      onPlayDataReset={() => {
        dispatch({ type: "clearStatsParty" });
        void stats.loadStats();
        void session.home.refreshResumable();
      }}
      initialMode={screen.mode}
      initialPartyId={screen.partyId}
      onPartyDetailClosed={() => dispatch({ type: "clearStatsParty" })}
      onOpenReview={session.review.open}
    />
  );
}

function InfoScreen({ screen, app }: { screen: ScreenOf<"info">; app: AppScreenContext }) {
  const { dispatch } = app;
  return (
    <InfoPage
      onGoHome={app.session.leave.home}
      rubricId={screen.rubricId}
      onRubricIdChange={(rubricId) => dispatch({ type: "setGuideRubric", rubricId })}
      onOpenLearn={() => dispatch({ type: "openLearn" })}
    />
  );
}

function LearnScreen({ screen, app }: { screen: ScreenOf<"learn">; app: AppScreenContext }) {
  const { lesson } = app.session;
  return (
    <LearnPage
      onGoHome={app.session.leave.home}
      articleId={screen.articleId}
      onArticleIdChange={(articleId) => app.dispatch({ type: "setLearnArticle", articleId })}
      onPracticeThis={(technique) => lesson.start(technique, "practice")}
      practiceBusy={lesson.busy}
      practiceError={lesson.error}
    />
  );
}

function SettingsScreen({ app }: { app: AppScreenContext }) {
  return (
    <AssistsPage
      assists={app.settings.assists}
      assistRows={app.settings.assistRows}
      onAssistToggle={app.settings.setAssist}
      onOpenGuideAssists={() => app.dispatch({ type: "openGuide", rubricId: "assists" })}
      onGoHome={app.session.leave.home}
    />
  );
}

function PlayScreen({ screen, app }: { screen: ScreenOf<"play">; app: AppScreenContext }) {
  const { dispatch, session } = app;
  const { analysis, lesson } = session;
  return (
    <PlayPage
      key={screen.game.id}
      initialGame={screen.game}
      assists={screen.assists}
      isPaused={screen.paused}
      onResume={() => dispatch({ type: "setPaused", paused: false })}
      onTogglePause={() => dispatch({ type: "setPaused", paused: !screen.paused })}
      onLeaveToHome={session.leave.home}
      onStatsRefresh={() => void app.stats.loadStats()}
      onOpenRating={session.leave.rating}
      onOpenPartyResults={session.review.openParty}
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
  );
}

function screenContent(screen: ScreenState, app: AppScreenContext) {
  switch (screen.name) {
    case "home":
      return <HomeScreen app={app} />;
    case "review":
      return <ReviewScreen screen={screen} app={app} />;
    case "stats":
      return <StatsScreen screen={screen} app={app} />;
    case "rating":
      return <RatingPage onGoHome={app.session.leave.home} />;
    case "info":
      return <InfoScreen screen={screen} app={app} />;
    case "learn":
      return <LearnScreen screen={screen} app={app} />;
    case "settings":
      return <SettingsScreen app={app} />;
    case "play":
      return <PlayScreen screen={screen} app={app} />;
  }
}

export function ActiveScreen({ screen, app }: { screen: ScreenState; app: AppScreenContext }) {
  return <Layout bare>{screenContent(screen, app)}</Layout>;
}
