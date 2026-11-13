import type { Difficulty } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HomeContinue, HomeIndex, HomeLead, HomeMasthead } from "@/components/HomeSections";
import { HomeWatermarkGrid } from "@/components/HomeWatermarkGrid";
import type { PlaySessionHome } from "@/hooks/playSessionTypes";
import { useLearningMenu } from "@/hooks/useLearningMenu";

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
  const { playLocked, creating, error } = home;
  const playActionsDisabled = home.loading || creating || playLocked;
  const learning = useLearningMenu();
  const bannerMessage = error ?? learning.error;
  const bannerReconnecting = error !== null ? home.reconnecting === true : learning.reconnecting;

  return (
    <div className="gazette-home gazette-home-watermark">
      <HomeWatermarkGrid />

      <div className="gazette-home-foreground">
        <HomeMasthead />

        {bannerMessage !== null && (
          <div className="px-4 pt-2">
            <ErrorBanner
              message={bannerMessage}
              reconnecting={bannerReconnecting}
              onAutoClear={error !== null && !bannerReconnecting ? home.clearError : undefined}
            />
          </div>
        )}

        <div className="gazette-home-sheet">
          <HomeLead
            difficulty={difficulty}
            playLocked={playLocked}
            creating={creating}
            disabled={playActionsDisabled}
            onStartNew={home.startNew}
            onDifficultyChange={onDifficultyChange}
          />
          <HomeIndex
            learningLabel={learning.label}
            playDisabled={playActionsDisabled}
            onPlayWithFriends={home.playWithFriends}
            onOpenLearn={onOpenLearn}
            onOpenGuide={onOpenGuide}
            onOpenSettings={onOpenSettings}
            onOpenResults={onOpenResults}
            onOpenRating={onOpenRating}
          />
        </div>

        <HomeContinue
          hasResumableGame={home.hasResumableGame}
          disabled={playActionsDisabled}
          onContinue={home.continueGame}
        />
      </div>
    </div>
  );
}
