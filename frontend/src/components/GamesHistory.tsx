import type { GameHistoryItem } from "@/api/types";
import { GamesPageControls } from "@/components/GamesPageControls";
import {
  GAMES_PAGE_SIZE,
  type GamesDifficultyFilter,
  type GamesStatusFilter,
} from "@/hooks/usePvpHistory";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import { formatPartyStartedAt } from "@/lib/format/formatPartyLobbyName";

const GAMES_DIFFICULTY_FILTERS: { value: GamesDifficultyFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const GAMES_STATUS_FILTERS: { value: GamesStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

function parseGamesDifficultyFilter(value: string): GamesDifficultyFilter {
  const match = GAMES_DIFFICULTY_FILTERS.find((option) => option.value === value);
  if (!match) {
    throw new Error(`unknown games difficulty filter: ${value}`);
  }
  return match.value;
}

function parseGamesStatusFilter(value: string): GamesStatusFilter {
  const match = GAMES_STATUS_FILTERS.find((option) => option.value === value);
  if (!match) {
    throw new Error(`unknown games status filter: ${value}`);
  }
  return match.value;
}

function formatHistoryStatus(status: GameHistoryItem["status"]): string {
  if (status === "completed") {
    return "Completed";
  }
  if (status === "abandoned") {
    return "Abandoned";
  }
  return "In progress";
}

function HistoryStatusMark({ status }: { status: GameHistoryItem["status"] }) {
  const label = formatHistoryStatus(status);
  return (
    <span className="gazette-stats-games-status" aria-label={label} title={label}>
      {status === "completed" ? (
        <HistoryStatusCheck />
      ) : status === "abandoned" ? (
        <HistoryStatusCross />
      ) : (
        <HistoryStatusCurrent />
      )}
    </span>
  );
}

function HistoryStatusCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M5 12.5 10 17.5 19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryStatusCross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M6 6 18 18" strokeLinecap="round" />
      <path d="M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function HistoryStatusCurrent() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
    </svg>
  );
}

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
      <div className="gazette-stats-games-filters">
        <label className="gazette-stats-games-filter" htmlFor="games-filter-difficulty">
          <span className="gazette-stats-games-filter-label">Difficulty</span>
          <select
            id="games-filter-difficulty"
            className="gazette-stats-games-filter-select"
            value={difficultyFilter}
            onChange={(event) => {
              onDifficultyChange(parseGamesDifficultyFilter(event.target.value));
            }}
          >
            {GAMES_DIFFICULTY_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="gazette-stats-games-filter" htmlFor="games-filter-status">
          <span className="gazette-stats-games-filter-label">Status</span>
          <select
            id="games-filter-status"
            className="gazette-stats-games-filter-select"
            value={statusFilter}
            onChange={(event) => {
              onStatusChange(parseGamesStatusFilter(event.target.value));
            }}
          >
            {GAMES_STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
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
                {history.map((item) => {
                  const isClickable = !item.is_party || Boolean(item.party_id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="gazette-stats-games-item"
                        disabled={!isClickable || reviewBusy}
                        onClick={() => onHistoryItemClick(item)}
                      >
                        <span className="gazette-stats-games-line">
                          {item.is_party && (
                            <>
                              Party
                              <span className="gazette-stats-games-dot" aria-hidden="true">
                                ·
                              </span>
                            </>
                          )}
                          {formatPartyStartedAt(item.started_at)}
                          <span className="gazette-stats-games-dot" aria-hidden="true">
                            ·
                          </span>
                          <span className="capitalize">{item.difficulty}</span>
                          <span className="gazette-stats-games-dot" aria-hidden="true">
                            ·
                          </span>
                          {formatElapsedSeconds(item.elapsed_seconds)}
                          <span className="gazette-stats-games-dot" aria-hidden="true">
                            ·
                          </span>
                          <HistoryStatusMark status={item.status} />
                        </span>
                      </button>
                    </li>
                  );
                })}
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
      <footer className="gazette-stats-find-game-footer">
        <div className="gazette-stats-find-game-footer-rule" aria-hidden="true" />
        <form
          className="gazette-stats-find-game"
          onSubmit={(event) => {
            event.preventDefault();
            onFindSubmit();
          }}
        >
          <div className="gazette-stats-find-game-row">
            <label className="gazette-stats-find-game-label" htmlFor="find-game-code">
              Find game
            </label>
            <input
              id="find-game-code"
              type="text"
              className="gazette-stats-find-game-input"
              value={findCode}
              placeholder="CODE"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onFindCodeChange(event.target.value.toUpperCase())}
            />
            <button
              type="submit"
              className="gazette-stats-find-game-submit"
              disabled={findBusy || !findCode.trim()}
            >
              {findBusy ? "…" : "Go"}
            </button>
          </div>
          {findError && <p className="gazette-stats-find-game-error">{findError}</p>}
        </form>
      </footer>
    </>
  );
}
