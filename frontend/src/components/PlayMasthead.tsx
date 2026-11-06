import type { Difficulty } from "@/api/types";
import { cn } from "@/lib/classNames";
import { lessonHudTitle } from "@/lib/play/lessonArticleId";
import type { PlayMode } from "@/lib/play/playMode";

type PlayMastheadProps = {
  mode: PlayMode;
  isPlaying: boolean;
  isPartyGame: boolean;
  difficulty: Difficulty;
  lobbyOpen: boolean;
  isPaused: boolean;
  lessonTechnique: string | null;
  onToggleLobby: () => void;
  onTogglePause: () => void;
  onLeaveToHome: () => void;
};

export function PlayMasthead({
  mode,
  isPlaying,
  isPartyGame,
  difficulty,
  lobbyOpen,
  isPaused,
  lessonTechnique,
  onToggleLobby,
  onTogglePause,
  onLeaveToHome,
}: PlayMastheadProps) {
  return (
    <header
      className={cn(
        "gazette-play-masthead",
        mode.kind !== "solo" && "gazette-play-masthead-analysis",
      )}
    >
      <div className="gazette-play-masthead-row">
        {mode.kind === "lesson" ? (
          <>
            <h1 className="home-masthead gazette-play-analysis-title">
              {lessonHudTitle(lessonTechnique)}
            </h1>
            <div className="gazette-play-masthead-actions">
              <button
                type="button"
                onClick={mode.onBackToGuide}
                className="gazette-play-header-link"
              >
                Back to Learning
              </button>
            </div>
          </>
        ) : (
          <>
            {isPlaying && mode.kind === "solo" && (
              <div className="gazette-play-difficulty">
                <span>{difficulty}</span>
                {isPartyGame && (
                  <>
                    <span className="gazette-play-header-sep" aria-hidden="true">
                      ·
                    </span>
                    <button
                      type="button"
                      className={cn(
                        "gazette-play-lobby-link",
                        lobbyOpen && "gazette-play-lobby-link-active",
                      )}
                      aria-expanded={lobbyOpen}
                      onClick={onToggleLobby}
                    >
                      Lobby Stats
                    </button>
                  </>
                )}
              </div>
            )}
            {isPlaying && mode.kind === "analysis" && (
              <h1 className="home-masthead gazette-play-analysis-title">Analysis mode</h1>
            )}
            {isPlaying && mode.kind === "solo" && (
              <div className="gazette-play-masthead-actions">
                <button type="button" onClick={onTogglePause} className="gazette-play-header-link">
                  {isPaused ? "Resume" : "Pause"}
                </button>
                <span className="gazette-play-header-sep" aria-hidden="true">
                  ·
                </span>
                <button type="button" onClick={onLeaveToHome} className="gazette-play-header-link">
                  Go home
                </button>
              </div>
            )}
            {isPlaying && mode.kind === "analysis" && (
              <div className="gazette-play-masthead-actions">
                <button type="button" onClick={onLeaveToHome} className="gazette-play-header-link">
                  Go home
                </button>
                <span className="gazette-play-header-sep" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={mode.onBackToReview}
                  className="gazette-play-header-link"
                >
                  Back
                </button>
              </div>
            )}
            {!isPlaying && (
              <button type="button" onClick={onLeaveToHome} className="gazette-play-go-home">
                Go home
              </button>
            )}
          </>
        )}
      </div>
      <div className="gazette-home-masthead-rule" />
    </header>
  );
}
