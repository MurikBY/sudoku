import type { ReactNode } from "react";

import type { Difficulty, DifficultyStats, StatsPeriod, UserStats } from "@/api/types";
import { formatOptionalElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import { formatOptionalAverage, winRatePercentValue } from "@/lib/format/statsDisplay";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

const STATS_PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "month", label: "30 days" },
  { value: "week", label: "7 days" },
];

const DIFFICULTY_ROWS: {
  label: string;
  value: (stats: DifficultyStats) => ReactNode;
}[] = [
  {
    label: "Started",
    value: (stats) => String(stats.games_started),
  },
  {
    label: "Wins",
    value: (stats) => <WinRateValue winRate={stats.win_rate} count={stats.games_completed} />,
  },
  {
    label: "Clean Wins",
    value: (stats) => <WinRateValue winRate={stats.clean_win_rate} count={stats.clean_wins} />,
  },
  {
    label: "Avg Clean Wins",
    value: (stats) => formatOptionalElapsedSeconds(stats.avg_clean_seconds),
  },
  {
    label: "Avg hints",
    value: (stats) => formatOptionalAverage(stats.avg_hints),
  },
  {
    label: "Avg pencil",
    value: (stats) => formatOptionalAverage(stats.avg_pencil),
  },
];

function WinRateValue({ winRate, count }: { winRate: number | null; count: number }) {
  const percent = winRatePercentValue(winRate);
  if (percent === null) {
    return "–";
  }
  return (
    <>
      {count}
      <span className="gazette-stats-rate-count">
        {" "}
        ({percent}
        <span className="gazette-stats-percent">%</span>)
      </span>
    </>
  );
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="gazette-stats-overview-row">
      <span className="gazette-stats-overview-label">{label}</span>
      <span className="gazette-stats-overview-dots" aria-hidden="true" />
      <span className="gazette-stats-overview-value">{value}</span>
    </div>
  );
}

type StatsPeriodTabsProps = {
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
};

export function StatsPeriodTabs({ period, onPeriodChange }: StatsPeriodTabsProps) {
  return (
    <div
      className="gazette-stats-chrome gazette-stats-period"
      role="tablist"
      aria-label="Statistics period"
    >
      {STATS_PERIODS.map((option, index) => {
        const isActive = period === option.value;
        return (
          <span key={option.value} className="gazette-stats-period-item">
            {index > 0 && (
              <span className="gazette-stats-period-sep" aria-hidden="true">
                /
              </span>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              className={
                isActive
                  ? "gazette-stats-period-tab gazette-stats-period-tab-active"
                  : "gazette-stats-period-tab"
              }
              onClick={() => onPeriodChange(option.value)}
            >
              {option.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

export function SoloOverview({ stats }: { stats: UserStats }) {
  return (
    <section className="gazette-stats-ledger-block">
      <div className="gazette-stats-ledger-rule" aria-hidden="true" />
      <div className="flex flex-col">
        <StatRow label="Games started" value={String(stats.games_started)} />
        <StatRow
          label="Wins"
          value={<WinRateValue winRate={stats.win_rate} count={stats.games_completed} />}
        />
        <StatRow
          label="Clean Wins"
          value={<WinRateValue winRate={stats.clean_win_rate} count={stats.clean_wins} />}
        />
        <StatRow label="Avg hints" value={formatOptionalAverage(stats.avg_hints)} />
        <StatRow label="Avg pencil" value={formatOptionalAverage(stats.avg_pencil)} />
      </div>
      <div className="gazette-stats-ledger-rule" aria-hidden="true" />
    </section>
  );
}

export function DifficultyTable({ stats }: { stats: UserStats }) {
  return (
    <section className="gazette-stats-ledger-block">
      <div className="gazette-stats-ledger-rule" aria-hidden="true" />
      <table className="stats-difficulty-table">
        <thead>
          <tr>
            <th scope="col" className="stats-difficulty-table-metric">
              Metric
            </th>
            {DIFFICULTIES.map((difficulty) => (
              <th key={difficulty} scope="col" className="capitalize">
                {difficulty}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIFFICULTY_ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="stats-difficulty-table-metric">
                {row.label}
              </th>
              {DIFFICULTIES.map((difficulty) => (
                <td key={difficulty}>{row.value(stats.by_difficulty[difficulty])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gazette-stats-ledger-rule" aria-hidden="true" />
    </section>
  );
}

type ResetStatsControlProps = {
  resetBusy: boolean;
  resetError: string | null;
  onReset: () => void;
};

export function ResetStatsControl({ resetBusy, resetError, onReset }: ResetStatsControlProps) {
  return (
    <div className="gazette-stats-chrome gazette-stats-chrome-reset gazette-stats-reset">
      <button
        type="button"
        className="gazette-stats-reset-btn"
        disabled={resetBusy}
        onClick={onReset}
      >
        {resetBusy ? "Resetting…" : "Reset my stats"}
      </button>
      {resetError && <p className="error gazette-stats-reset-error">{resetError}</p>}
    </div>
  );
}
