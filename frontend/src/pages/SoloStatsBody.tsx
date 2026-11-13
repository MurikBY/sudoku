import type { StatsPeriod, UserStats } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  DifficultyTable,
  ResetStatsControl,
  SoloOverview,
  StatsPeriodTabs,
} from "@/components/SoloStatsSections";
import { usePlayDataReset } from "@/hooks/usePlayDataReset";

const SUDOKU_FACTS = [
  "The modern name Sudoku was coined in Japan in 1984; the grid itself first appeared in New York as Number Place in 1979.",
] as const;

type SoloStatsBodyProps = {
  stats: UserStats | null;
  period: StatsPeriod;
  loading: boolean;
  error: string | null;
  reconnecting?: boolean;
  onPeriodChange: (period: StatsPeriod) => void;
  onPlayDataReset: () => void;
};

export function SoloStatsBody({
  stats,
  period,
  loading,
  error,
  reconnecting,
  onPeriodChange,
  onPlayDataReset,
}: SoloStatsBodyProps) {
  const showInitialLoading = loading && !stats;
  const reset = usePlayDataReset(onPlayDataReset);

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
          <StatsPeriodTabs period={period} onPeriodChange={onPeriodChange} />

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
              <SoloOverview stats={stats} />
              <div className="gazette-stats-chrome gazette-stats-chrome-fact">
                <p className="gazette-stats-fact">{SUDOKU_FACTS[0]}</p>
              </div>
              <DifficultyTable stats={stats} />
              <ResetStatsControl
                resetBusy={reset.resetBusy}
                resetError={reset.resetError}
                onReset={() => void reset.requestReset()}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
