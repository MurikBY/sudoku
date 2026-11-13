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

function HeaderSep() {
  return (
    <span className="gazette-play-header-sep" aria-hidden="true">
      ·
    </span>
  );
}

function HeaderLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="gazette-play-header-link">
      {label}
    </button>
  );
}

function LessonRow({
  technique,
  onBackToGuide,
}: {
  technique: string | null;
  onBackToGuide: () => void;
}) {
  return (
    <>
      <h1 className="home-masthead gazette-play-analysis-title">{lessonHudTitle(technique)}</h1>
      <div className="gazette-play-masthead-actions">
        <HeaderLink label="Back to Learning" onClick={onBackToGuide} />
      </div>
    </>
  );
}

type SoloRowProps = Pick<
  PlayMastheadProps,
  | "difficulty"
  | "isPartyGame"
  | "lobbyOpen"
  | "isPaused"
  | "onToggleLobby"
  | "onTogglePause"
  | "onLeaveToHome"
>;

function SoloRow(props: SoloRowProps) {
  const { lobbyOpen } = props;
  return (
    <>
      <div className="gazette-play-difficulty">
        <span>{props.difficulty}</span>
        {props.isPartyGame && (
          <>
            <HeaderSep />
            <button
              type="button"
              className={cn(
                "gazette-play-lobby-link",
                lobbyOpen && "gazette-play-lobby-link-active",
              )}
              aria-expanded={lobbyOpen}
              onClick={props.onToggleLobby}
            >
              Lobby Stats
            </button>
          </>
        )}
      </div>
      <div className="gazette-play-masthead-actions">
        <HeaderLink label={props.isPaused ? "Resume" : "Pause"} onClick={props.onTogglePause} />
        <HeaderSep />
        <HeaderLink label="Go home" onClick={props.onLeaveToHome} />
      </div>
    </>
  );
}

function AnalysisRow({
  onLeaveToHome,
  onBackToReview,
}: {
  onLeaveToHome: () => void;
  onBackToReview: () => void;
}) {
  return (
    <>
      <h1 className="home-masthead gazette-play-analysis-title">Analysis mode</h1>
      <div className="gazette-play-masthead-actions">
        <HeaderLink label="Go home" onClick={onLeaveToHome} />
        <HeaderSep />
        <HeaderLink label="Back" onClick={onBackToReview} />
      </div>
    </>
  );
}

function MastheadRow(props: PlayMastheadProps) {
  const { mode } = props;
  if (mode.kind === "lesson") {
    return <LessonRow technique={props.lessonTechnique} onBackToGuide={mode.onBackToGuide} />;
  }
  if (!props.isPlaying) {
    return (
      <button type="button" onClick={props.onLeaveToHome} className="gazette-play-go-home">
        Go home
      </button>
    );
  }
  if (mode.kind === "solo") {
    return <SoloRow {...props} />;
  }
  return <AnalysisRow onLeaveToHome={props.onLeaveToHome} onBackToReview={mode.onBackToReview} />;
}

export function PlayMasthead(props: PlayMastheadProps) {
  return (
    <header
      className={cn(
        "gazette-play-masthead",
        props.mode.kind !== "solo" && "gazette-play-masthead-analysis",
      )}
    >
      <div className="gazette-play-masthead-row">
        <MastheadRow {...props} />
      </div>
      <div className="gazette-home-masthead-rule" />
    </header>
  );
}
