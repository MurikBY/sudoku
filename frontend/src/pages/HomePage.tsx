import { useQuery } from "@tanstack/react-query";

import { fetchLessonProgress } from "@/api/games";
import type { Difficulty, LessonProgressResponse } from "@/api/types";
import { DifficultyLinks } from "@/components/DifficultyLinks";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HomeIndexLink } from "@/components/HomeIndexLink";
import { HomeWatermarkGrid } from "@/components/HomeWatermarkGrid";
import type { PlaySessionHome } from "@/hooks/playSessionTypes";
import { queryLoadError, queryLoadReconnecting } from "@/lib/api/queryLoadStatus";
import { formatGazetteDateline } from "@/lib/format/gazetteDate";
import { completedLessonTally, lessonProgressByTechnique } from "@/content/techniquesGuideCopy";

const CONTINUE_IDLE_FACT = "A sudoku grid can be filled completely in about 6.67×10²¹ ways.";

function learningMenuLabel(payload: LessonProgressResponse | undefined): string {
  if (payload === undefined) {
    return "Learning";
  }
  const tally = completedLessonTally(lessonProgressByTechnique(payload.items));
  return `Learning (${tally.completed}/${tally.total})`;
}

type HomePageProps = {
  difficulty: Difficulty;
  home: PlaySessionHome;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onOpenResults: () => void;
  onOpenRating: () => void;
  onOpenSettings: () => void;
  onOpenLearn: () => void;
  onOpenGuide: () => void;
};

export function HomePage({
  difficulty,
  home,
  onDifficultyChange,
  onOpenResults,
  onOpenRating,
  onOpenSettings,
  onOpenLearn,
  onOpenGuide,
}: HomePageProps) {
  const {
    playLocked,
    loading,
    creating,
    error,
    reconnecting,
    hasResumableGame,
    clearError,
    startNew,
    continueGame,
    playWithFriends,
  } = home;
  const playActionsDisabled = loading || creating || playLocked;
  const progressQuery = useQuery({
    queryKey: ["lesson-progress"],
    queryFn: () => fetchLessonProgress(),
  });
  const lessonError = queryLoadError(progressQuery);
  const bannerMessage = error ?? lessonError;
  const bannerReconnecting =
    error !== null ? reconnecting === true : queryLoadReconnecting(progressQuery);
  const learningLabel = learningMenuLabel(progressQuery.data);

  return (
    <div className="gazette-home gazette-home-watermark">
      <HomeWatermarkGrid />

      <div className="gazette-home-foreground">
        <header className="gazette-home-masthead home-masthead-panel">
          <p className="gazette-home-kicker">Puzzle edition</p>
          <h1 className="home-masthead home-masthead-title">The Daily Sudoku</h1>
          <p className="home-masthead-date font-mono text-[0.58rem] tracking-[0.04em] text-muted-foreground">
            {formatGazetteDateline()}
          </p>
          <div className="gazette-home-masthead-rule" />
        </header>

        {bannerMessage !== null && (
          <div className="px-4 pt-2">
            <ErrorBanner
              message={bannerMessage}
              reconnecting={bannerReconnecting}
              onAutoClear={error !== null && !bannerReconnecting ? clearError : undefined}
            />
          </div>
        )}

        <div className="gazette-home-sheet">
          <section className="gazette-front-lead">
            {playLocked && (
              <p className="home-play-lock-hint" role="status">
                Another device is playing. Leave the game there, or wait about 30 seconds.
              </p>
            )}
            <button
              type="button"
              disabled={playActionsDisabled}
              onClick={startNew}
              className="gazette-front-hed"
            >
              {creating ? "Setting the type…" : "NEW GAME"}
            </button>
            <div className="home-difficulty-band">
              <hr className="home-band-rule" />
              <DifficultyLinks
                className="home-difficulty-row-editorial"
                difficulty={difficulty}
                onDifficultyChange={onDifficultyChange}
              />
              <hr className="home-band-rule" />
            </div>
          </section>

          <nav className="home-index" aria-label="Home">
            <div className="home-index-group">
              <HomeIndexLink
                label="Play with Friends"
                disabled={playActionsDisabled}
                onClick={playWithFriends}
              />
              <HomeIndexLink label={learningLabel} onClick={onOpenLearn} />
            </div>
            <div className="home-index-group">
              <HomeIndexLink label="Guide" onClick={onOpenGuide} />
              <HomeIndexLink label="Settings" onClick={onOpenSettings} />
              <HomeIndexLink label="My Stats" onClick={onOpenResults} />
              <HomeIndexLink label="Rating" onClick={onOpenRating} />
            </div>
          </nav>
        </div>

        <footer className="gazette-home-continue">
          <div className="gazette-home-continue-rule" />
          <div className="gazette-home-continue-body">
            {hasResumableGame ? (
              <button
                type="button"
                disabled={playActionsDisabled}
                onClick={continueGame}
                className="home-play-button disabled:opacity-45"
              >
                <span>Continue last game</span>
              </button>
            ) : (
              <p className="gazette-home-continue-idle" aria-hidden="true">
                {CONTINUE_IDLE_FACT}
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
