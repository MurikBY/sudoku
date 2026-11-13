import type { GameHistoryItem } from "@/api/types";
import { GamesPageControls } from "@/components/GamesPageControls";
import { FindGameForm, GamesFilters, HistoryItemButton } from "@/components/GamesHistorySections";
import {
  GAMES_PAGE_SIZE,
  type GamesDifficultyFilter,
  type GamesStatusFilter,
} from "@/hooks/usePvpHistory";

type GamesHistoryProps = {
  history: GameHistoryItem[] | null;
  historyTotal: number;
  historyPage: number;
  difficultyFilter: GamesDifficultyFilter;
  statusFilter: GamesStatusFilter;
  loading: boolean;
  reviewBusy: boolean;
  findCode: string;
  findBusy: boolean;
  findError: string | null;
  onDifficultyChange: (value: GamesDifficultyFilter) => void;
  onStatusChange: (value: GamesStatusFilter) => void;
  onPageChange: (nextPage: number) => void;
  onHistoryItemClick: (item: GameHistoryItem) => void;
  onFindCodeChange: (value: string) => void;
  onFindSubmit: () => void;
};

export function GamesHistory({
  history,
  historyTotal,
  historyPage,
  difficultyFilter,
  statusFilter,
  loading,
  reviewBusy,
  findCode,
  findBusy,
  findError,
  onDifficultyChange,
  onStatusChange,
  onPageChange,
  onHistoryItemClick,
  onFindCodeChange,
  onFindSubmit,
}: GamesHistoryProps) {
  const showInitialLoading = loading && history === null;
  const historyPageCount = Math.max(1, Math.ceil(historyTotal / GAMES_PAGE_SIZE));
  const filtersActive = difficultyFilter !== "all" || statusFilter !== "all";

  return (
    <>
      <GamesFilters
        difficultyFilter={difficultyFilter}
        statusFilter={statusFilter}
        onDifficultyChange={onDifficultyChange}
        onStatusChange={onStatusChange}
      />
      <div className="gazette-stats-ledger gazette-stats-games-ledger">
        {showInitialLoading && (
          <p className="py-10 text-center font-display text-lg italic text-muted-foreground">
            Loading games…
          </p>
        )}
        {!showInitialLoading && history && history.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {filtersActive
              ? "No games match these filters."
              : "No games yet. Start one from the home screen."}
          </p>
        )}
        {history && history.length > 0 && (
          <div
            className={
              loading
                ? "gazette-stats-ledger-body gazette-stats-ledger-refreshing"
                : "gazette-stats-ledger-body"
            }
          >
            <section className="gazette-stats-ledger-block gazette-stats-games-block">
              <ul className="gazette-stats-games-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <HistoryItemButton
                      item={item}
                      reviewBusy={reviewBusy}
                      onClick={onHistoryItemClick}
                    />
                  </li>
                ))}
              </ul>
            </section>
            <GamesPageControls
              page={historyPage}
              pageCount={historyTotal === 0 ? 0 : historyPageCount}
              disabled={loading || reviewBusy}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>
      <FindGameForm
        findCode={findCode}
        findBusy={findBusy}
        findError={findError}
        onFindCodeChange={onFindCodeChange}
        onFindSubmit={onFindSubmit}
      />
    </>
  );
}
