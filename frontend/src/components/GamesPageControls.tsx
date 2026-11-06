const GAMES_PAGE_JUMP = 10;

type GamesPageControlsProps = {
  page: number;
  pageCount: number;
  disabled: boolean;
  onPageChange: (nextPage: number) => void;
};

export function GamesPageControls({
  page,
  pageCount,
  disabled,
  onPageChange,
}: GamesPageControlsProps) {
  if (pageCount <= 1) {
    return null;
  }

  function go(delta: number) {
    const nextPage = Math.min(pageCount - 1, Math.max(0, page + delta));
    if (nextPage === page) {
      return;
    }
    onPageChange(nextPage);
  }

  return (
    <div className="gazette-stats-games-pager">
      <button
        type="button"
        className="gazette-stats-games-pager-btn"
        aria-label={`Back ${GAMES_PAGE_JUMP} pages`}
        disabled={disabled || page === 0}
        onClick={() => go(-GAMES_PAGE_JUMP)}
      >
        «
      </button>
      <button
        type="button"
        className="gazette-stats-games-pager-btn"
        aria-label="Previous page"
        disabled={disabled || page === 0}
        onClick={() => go(-1)}
      >
        ‹
      </button>
      <span className="gazette-stats-games-pager-status">
        {page + 1} / {pageCount}
      </span>
      <button
        type="button"
        className="gazette-stats-games-pager-btn"
        aria-label="Next page"
        disabled={disabled || page >= pageCount - 1}
        onClick={() => go(1)}
      >
        ›
      </button>
      <button
        type="button"
        className="gazette-stats-games-pager-btn"
        aria-label={`Forward ${GAMES_PAGE_JUMP} pages`}
        disabled={disabled || page >= pageCount - 1}
        onClick={() => go(GAMES_PAGE_JUMP)}
      >
        »
      </button>
    </div>
  );
}
