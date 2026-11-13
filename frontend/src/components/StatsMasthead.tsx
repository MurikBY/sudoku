import type { StatsMode } from "@/hooks/useStatsMode";

const STATS_MODES = [
  { value: "solo", label: "Stats" },
  { value: "pvp", label: "Games" },
] as const;

function StatsModeTabs({
  mode,
  onSelectMode,
}: {
  mode: StatsMode;
  onSelectMode: (mode: StatsMode) => void;
}) {
  return (
    <div className="gazette-stats-mode" role="tablist" aria-label="Statistics mode">
      {STATS_MODES.map((option, index) => {
        const isActive = mode === option.value;
        return (
          <span key={option.value} className="gazette-stats-period-item">
            {index > 0 && (
              <span className="gazette-stats-mode-sep-dot" aria-hidden="true">
                ·
              </span>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                isActive
                  ? "gazette-stats-mode-tab gazette-stats-mode-tab-active"
                  : "gazette-stats-mode-tab"
              }
              onClick={() => onSelectMode(option.value)}
            >
              {option.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function PvpMastheadTitle({ title }: { title: string }) {
  return (
    <div className="gazette-stats-pvp-masthead-title-block">
      <div className="gazette-home-masthead-rule" aria-hidden="true" />
      <h2
        className={
          title === "Games"
            ? "gazette-stats-pvp-masthead-title gazette-stats-pvp-masthead-title-list"
            : "gazette-stats-pvp-masthead-title"
        }
      >
        {title}
      </h2>
    </div>
  );
}

type StatsMastheadProps = {
  mode: StatsMode;
  pvpMastheadTitle: string | null;
  onSelectMode: (mode: StatsMode) => void;
  onGoHome: () => void;
};

export function StatsMasthead({
  mode,
  pvpMastheadTitle,
  onSelectMode,
  onGoHome,
}: StatsMastheadProps) {
  return (
    <header className="gazette-home-masthead gazette-stats-masthead">
      <div className="gazette-stats-masthead-row">
        <StatsModeTabs mode={mode} onSelectMode={onSelectMode} />
        <button type="button" onClick={onGoHome} className="gazette-stats-go-home">
          Go home
        </button>
      </div>
      {mode === "pvp" && pvpMastheadTitle && <PvpMastheadTitle title={pvpMastheadTitle} />}
      <div className="gazette-home-masthead-rule" />
    </header>
  );
}
