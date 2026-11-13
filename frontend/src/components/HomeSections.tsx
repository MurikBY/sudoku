import type { Difficulty } from "@/api/types";
import { DifficultyLinks } from "@/components/DifficultyLinks";
import { HomeIndexLink } from "@/components/HomeIndexLink";
import { formatGazetteDateline } from "@/lib/format/gazetteDate";

const CONTINUE_IDLE_FACT = "A sudoku grid can be filled completely in about 6.67×10²¹ ways.";

export function HomeMasthead() {
  return (
    <header className="gazette-home-masthead home-masthead-panel">
      <p className="gazette-home-kicker">Puzzle edition</p>
      <h1 className="home-masthead home-masthead-title">The Daily Sudoku</h1>
      <p className="home-masthead-date font-mono text-[0.58rem] tracking-[0.04em] text-muted-foreground">
        {formatGazetteDateline()}
      </p>
      <div className="gazette-home-masthead-rule" />
    </header>
  );
}

type HomeLeadProps = {
  difficulty: Difficulty;
  playLocked: boolean;
  creating: boolean;
  disabled: boolean;
  onStartNew: () => void;
  onDifficultyChange: (difficulty: Difficulty) => void;
};

export function HomeLead({
  difficulty,
  playLocked,
  creating,
  disabled,
  onStartNew,
  onDifficultyChange,
}: HomeLeadProps) {
  return (
    <section className="gazette-front-lead">
      {playLocked && (
        <p className="home-play-lock-hint" role="status">
          Another device is playing. Leave the game there, or wait about 30 seconds.
        </p>
      )}
      <button type="button" disabled={disabled} onClick={onStartNew} className="gazette-front-hed">
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
  );
}

type HomeIndexProps = {
  learningLabel: string;
  playDisabled: boolean;
  onPlayWithFriends: () => void;
  onOpenLearn: () => void;
  onOpenGuide: () => void;
  onOpenSettings: () => void;
  onOpenResults: () => void;
  onOpenRating: () => void;
};

export function HomeIndex({
  learningLabel,
  playDisabled,
  onPlayWithFriends,
  onOpenLearn,
  onOpenGuide,
  onOpenSettings,
  onOpenResults,
  onOpenRating,
}: HomeIndexProps) {
  return (
    <nav className="home-index" aria-label="Home">
      <div className="home-index-group">
        <HomeIndexLink
          label="Play with Friends"
          disabled={playDisabled}
          onClick={onPlayWithFriends}
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
  );
}

type HomeContinueProps = {
  hasResumableGame: boolean;
  disabled: boolean;
  onContinue: () => void;
};

export function HomeContinue({ hasResumableGame, disabled, onContinue }: HomeContinueProps) {
  return (
    <footer className="gazette-home-continue">
      <div className="gazette-home-continue-rule" />
      <div className="gazette-home-continue-body">
        {hasResumableGame ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onContinue}
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
  );
}
