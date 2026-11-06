import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchCleanBestRating } from "@/api/users";
import type { Difficulty, RatingDifficulty } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatOptionalElapsedSeconds } from "@/lib/format/formatElapsedSeconds";
import { queryInFlight, queryLoadError, queryLoadReconnecting } from "@/lib/api/queryLoadStatus";

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const RATING_PREVIEW_LIMIT = 3;

type RatingPageProps = {
  onGoHome: () => void;
};

export function RatingPage({ onGoHome }: RatingPageProps) {
  return (
    <div className="gazette-home">
      <header className="gazette-home-masthead gazette-stats-masthead">
        <div className="gazette-guide-masthead-row">
          <h1 className="home-masthead gazette-guide-title">Rating</h1>
          <button type="button" onClick={onGoHome} className="gazette-guide-go-home">
            Go home
          </button>
        </div>
        <div className="gazette-home-masthead-rule" />
      </header>
      <RatingStatsBody />
    </div>
  );
}

function RatingDifficultyBlock({
  difficulty,
  level,
  expanded,
  onExpand,
}: {
  difficulty: Difficulty;
  level: RatingDifficulty;
  expanded: boolean;
  onExpand: () => void;
}) {
  const visibleEntries = expanded ? level.entries : level.entries.slice(0, RATING_PREVIEW_LIMIT);
  const canExpand = !expanded && level.entries.length > RATING_PREVIEW_LIMIT;

  return (
    <section className="gazette-stats-ledger-block">
      <span className="gazette-stats-rating-difficulty capitalize">{difficulty}</span>
      <p className="gazette-stats-rating-average">
        {level.games_started} started
        {" · "}
        {level.games_completed} wins
        {" · "}
        {level.clean_wins} clean wins
        {" · "}
        avg = {formatOptionalElapsedSeconds(level.avg_clean_seconds)}
      </p>
      {level.entries.length === 0 ? (
        <p className="gazette-stats-rating-empty">No clean finishes yet.</p>
      ) : (
        <>
          <ol className="gazette-stats-rating-list">
            {visibleEntries.map((entry) => (
              <li key={entry.user_id} className="gazette-stats-rating-row">
                <span className="gazette-stats-rating-rank">{entry.rank}</span>
                <span className="gazette-stats-rating-name">
                  <span className="gazette-stats-rating-nick">{entry.display_name}</span>
                </span>
                <span className="gazette-stats-rating-time">
                  {formatOptionalElapsedSeconds(entry.best_time_seconds)}
                </span>
              </li>
            ))}
          </ol>
          {canExpand && (
            <button type="button" className="gazette-stats-rating-expand" onClick={onExpand}>
              Expand
            </button>
          )}
        </>
      )}
    </section>
  );
}

function RatingStatsBody() {
  const ratingQuery = useQuery({
    queryKey: ["clean-best-rating"],
    queryFn: () => fetchCleanBestRating(),
  });
  const [expandedByDifficulty, setExpandedByDifficulty] = useState<Record<Difficulty, boolean>>({
    easy: false,
    medium: false,
    hard: false,
  });
  const leaderboard = ratingQuery.data ?? null;
  const loading = queryInFlight(ratingQuery);
  const error = queryLoadError(ratingQuery);
  const reconnecting = queryLoadReconnecting(ratingQuery);
  const showBoard = leaderboard !== null;

  return (
    <>
      {error && (
        <div className="px-4 pt-2">
          <ErrorBanner message={error} reconnecting={reconnecting} />
        </div>
      )}
      <div className="gazette-stats-ledger gazette-stats-ledger-rating">
        <div
          className={
            loading && showBoard
              ? "gazette-stats-rating-fill gazette-stats-ledger-refreshing"
              : "gazette-stats-rating-fill"
          }
        >
          <div className="gazette-stats-rating-intro">
            <p className="gazette-stats-rating-heading">
              <span className="gazette-stats-rating-sort gazette-stats-rating-sort-active">
                Best
              </span>
              <span className="gazette-stats-rating-heading-core">clean wins</span>
            </p>
          </div>
          {!showBoard && (
            <p className="py-10 text-center font-display text-lg italic text-muted-foreground">
              Loading rating…
            </p>
          )}
          {showBoard && leaderboard && (
            <>
              {DIFFICULTIES.map((difficulty) => (
                <Fragment key={difficulty}>
                  <div className="gazette-stats-ledger-rule" aria-hidden="true" />
                  <div className="gazette-stats-rating-gap" aria-hidden="true" />
                  <RatingDifficultyBlock
                    difficulty={difficulty}
                    level={leaderboard[difficulty]}
                    expanded={expandedByDifficulty[difficulty]}
                    onExpand={() =>
                      setExpandedByDifficulty((current) => ({
                        ...current,
                        [difficulty]: true,
                      }))
                    }
                  />
                  <div className="gazette-stats-rating-gap" aria-hidden="true" />
                </Fragment>
              ))}
              <div className="gazette-stats-ledger-rule" aria-hidden="true" />
              <div className="gazette-stats-rating-gap" aria-hidden="true" />
            </>
          )}
        </div>
      </div>
    </>
  );
}
