import { useState, type ReactNode } from "react";

import { resetPlayData } from "@/api/users";
import type { Difficulty, DifficultyStats, StatsPeriod, UserStats } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { formatOptionalElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import { formatOptionalAverage, winRatePercentValue } from "@/lib/format/statsDisplay";

const SUDOKU_FACTS = [
  "The modern name Sudoku was coined in Japan in 1984; the grid itself first appeared in New York as Number Place in 1979.",
] as const;

const RESET_PLAY_DATA_CONFIRM = "This erases your games, rating, and game history. Cannot undo.";

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

function confirmResetPlayData(): Promise<boolean> {
  const showConfirm = window.Telegram?.WebApp?.showConfirm;
  if (typeof showConfirm === "function") {
    return new Promise((resolve) => {
      showConfirm(RESET_PLAY_DATA_CONFIRM, (confirmed) => {
        resolve(confirmed);
      });
    });
  }
  return Promise.resolve(window.confirm(RESET_PLAY_DATA_CONFIRM));
}

function SudokuFact({ text }: { text: string }) {
  return <p className="gazette-stats-fact">{text}</p>;
}

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

export function SoloStatsBody({
  stats,
  period,
  loading,
  error,
  reconnecting,
  onPeriodChange,
  onPlayDataReset,
}: {
  stats: UserStats | null;
  period: StatsPeriod;
  loading: boolean;
  error: string | null;
  reconnecting?: boolean;
  onPeriodChange: (period: StatsPeriod) => void;
  onPlayDataReset: () => void;
}) {
  const showInitialLoading = loading && !stats;
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetPlayData = async () => {
    if (resetBusy) {
      return;
    }
    const confirmed = await confirmResetPlayData();
    if (!confirmed) {
      return;
    }
    setResetBusy(true);
    setResetError(null);
    try {
      await resetPlayData();
      onPlayDataReset();
    } catch (caught) {
      setResetError(formatApiErrorMessage(caught));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <>
      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} reconnecting={reconnecting} />
        </div>
      )}

      <div className="gazette-stats-ledger gazette-stats-ledger-solo">
        <div
          className={
            loading && stats
              ? "gazette-stats-ledger-body gazette-stats-ledger-refreshing"
              : "gazette-stats-ledger-body"
          }
        >
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

          {showInitialLoading && (
            <p className="py-10 text-center font-display text-lg italic text-muted-foreground">
              Loading statistics…
            </p>
          )}

          {!showInitialLoading && !stats && !error && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Statistics are not available right now.
            </p>
          )}

          {stats && (
            <>
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

              <div className="gazette-stats-chrome gazette-stats-chrome-fact">
                <SudokuFact text={SUDOKU_FACTS[0]} />
              </div>

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

              <div className="gazette-stats-chrome gazette-stats-chrome-reset gazette-stats-reset">
                <button
                  type="button"
                  className="gazette-stats-reset-btn"
                  disabled={resetBusy}
                  onClick={() => void handleResetPlayData()}
                >
                  {resetBusy ? "Resetting…" : "Reset my stats"}
                </button>
                {resetError && <p className="error gazette-stats-reset-error">{resetError}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
