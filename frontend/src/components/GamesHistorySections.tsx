import type { GameHistoryItem } from "@/api/types";
import type { GamesDifficultyFilter, GamesStatusFilter } from "@/hooks/usePvpHistory";
import { formatElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import { formatPartyStartedAt } from "@/lib/format/formatPartyLobbyName";

type FilterOption<Value extends string> = { value: Value; label: string };

const GAMES_DIFFICULTY_FILTERS: FilterOption<GamesDifficultyFilter>[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const GAMES_STATUS_FILTERS: FilterOption<GamesStatusFilter>[] = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

type FilterSelectProps<Value extends string> = {
  id: string;
  label: string;
  filterName: string;
  value: Value;
  options: FilterOption<Value>[];
  onChange: (value: Value) => void;
};

function FilterSelect<Value extends string>({
  id,
  label,
  filterName,
  value,
  options,
  onChange,
}: FilterSelectProps<Value>) {
  const parse = (raw: string): Value => {
    const match = options.find((option) => option.value === raw);
    if (!match) {
      throw new Error(`unknown games ${filterName} filter: ${raw}`);
    }
    return match.value;
  };
  return (
    <label className="gazette-stats-games-filter" htmlFor={id}>
      <span className="gazette-stats-games-filter-label">{label}</span>
      <select
        id={id}
        className="gazette-stats-games-filter-select"
        value={value}
        onChange={(event) => {
          onChange(parse(event.target.value));
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type GamesFiltersProps = {
  difficultyFilter: GamesDifficultyFilter;
  statusFilter: GamesStatusFilter;
  onDifficultyChange: (value: GamesDifficultyFilter) => void;
  onStatusChange: (value: GamesStatusFilter) => void;
};

export function GamesFilters({
  difficultyFilter,
  statusFilter,
  onDifficultyChange,
  onStatusChange,
}: GamesFiltersProps) {
  return (
    <div className="gazette-stats-games-filters">
      <FilterSelect
        id="games-filter-difficulty"
        label="Difficulty"
        filterName="difficulty"
        value={difficultyFilter}
        options={GAMES_DIFFICULTY_FILTERS}
        onChange={onDifficultyChange}
      />
      <FilterSelect
        id="games-filter-status"
        label="Status"
        filterName="status"
        value={statusFilter}
        options={GAMES_STATUS_FILTERS}
        onChange={onStatusChange}
      />
    </div>
  );
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

function LineDot() {
  return (
    <span className="gazette-stats-games-dot" aria-hidden="true">
      ·
    </span>
  );
}

type HistoryItemButtonProps = {
  item: GameHistoryItem;
  reviewBusy: boolean;
  onClick: (item: GameHistoryItem) => void;
};

export function HistoryItemButton({ item, reviewBusy, onClick }: HistoryItemButtonProps) {
  const isClickable = !item.is_party || Boolean(item.party_id);
  return (
    <button
      type="button"
      className="gazette-stats-games-item"
      disabled={!isClickable || reviewBusy}
      onClick={() => onClick(item)}
    >
      <span className="gazette-stats-games-line">
        {item.is_party && (
          <>
            Party
            <LineDot />
          </>
        )}
        {formatPartyStartedAt(item.started_at)}
        <LineDot />
        <span className="capitalize">{item.difficulty}</span>
        <LineDot />
        {formatElapsedSeconds(item.elapsed_seconds)}
        <LineDot />
        <HistoryStatusMark status={item.status} />
      </span>
    </button>
  );
}

type FindGameFormProps = {
  findCode: string;
  findBusy: boolean;
  findError: string | null;
  onFindCodeChange: (value: string) => void;
  onFindSubmit: () => void;
};

export function FindGameForm({
  findCode,
  findBusy,
  findError,
  onFindCodeChange,
  onFindSubmit,
}: FindGameFormProps) {
  return (
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
  );
}
