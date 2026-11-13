import type { GameHistoryItem } from "@/api/types";
import { FindGameForm, GamesFilters, GamesLedger } from "@/components/GamesHistorySections";
import type { GamesDifficultyFilter, GamesStatusFilter } from "@/hooks/usePvpHistory";

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
  return (
    <>
      <GamesFilters
        difficultyFilter={difficultyFilter}
        statusFilter={statusFilter}
        onDifficultyChange={onDifficultyChange}
        onStatusChange={onStatusChange}
      />
      <GamesLedger
        history={history}
        historyTotal={historyTotal}
        historyPage={historyPage}
        filtersActive={difficultyFilter !== "all" || statusFilter !== "all"}
        loading={loading}
        reviewBusy={reviewBusy}
        onPageChange={onPageChange}
        onHistoryItemClick={onHistoryItemClick}
      />
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
