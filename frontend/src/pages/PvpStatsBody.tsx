import { useState } from "react";

import { fetchGameReview, fetchGameReviewByCode } from "@/api/games";
import type { GameHistoryItem, GameReview } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { GamesHistory } from "@/components/GamesHistory";
import { PartyResultsDetail } from "@/components/PartyResultsDetail";
import { usePartyMastheadTitle } from "@/hooks/usePartyMastheadTitle";
import { usePartyResults } from "@/hooks/usePartyResults";
import { usePvpHistory } from "@/hooks/usePvpHistory";
import { useReviewOpener } from "@/hooks/useReviewOpener";

type PvpStatsBodyProps = {
  initialPartyId: string | null;
  onMastheadTitleChange: (title: string | null) => void;
  onOpenReview: (review: GameReview) => void;
};

export function PvpStatsBody({
  initialPartyId,
  onMastheadTitleChange,
  onOpenReview,
}: PvpStatsBodyProps) {
  const [loading, setLoading] = useState(initialPartyId !== null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const { selectedPartyId, results, loadResults } = usePartyResults({
    initialPartyId,
    setLoading,
    setError,
    setReconnecting,
  });
  const history = usePvpHistory({ enabled: selectedPartyId === null, onOpenReview });
  const bannerError = error ?? (selectedPartyId === null ? history.error : null);
  const bannerReconnecting =
    error !== null ? reconnecting : selectedPartyId === null && history.reconnecting;

  usePartyMastheadTitle({ selectedPartyId, results, onMastheadTitleChange });
  const { reviewBusy, openReview } = useReviewOpener({ onOpenReview, setError });

  const handleHistoryItemClick = (item: GameHistoryItem) => {
    if (item.is_party && item.party_id) {
      void loadResults(item.party_id);
      return;
    }
    void openReview(() => fetchGameReview(item.id));
  };

  const banner = bannerError && (
    <div className="px-4 pt-2">
      <ErrorBanner message={bannerError} reconnecting={bannerReconnecting} />
    </div>
  );

  if (selectedPartyId && loading && !results) {
    return (
      <>
        {banner}
        <div className="gazette-stats-ledger">
          <p className="py-10 text-center font-display text-lg italic text-muted-foreground">
            Loading party results…
          </p>
        </div>
      </>
    );
  }

  if (selectedPartyId && results && results.id === selectedPartyId) {
    return (
      <>
        {banner}
        <PartyResultsDetail
          results={results}
          loading={loading}
          reviewBusy={reviewBusy}
          onReviewPlayer={(shareCode) => {
            void openReview(() => fetchGameReviewByCode(shareCode));
          }}
        />
      </>
    );
  }

  return (
    <>
      {banner}
      <PvpGamesHistory
        history={history}
        loading={history.loading || loading}
        reviewBusy={reviewBusy}
        onHistoryItemClick={handleHistoryItemClick}
      />
    </>
  );
}

type PvpGamesHistoryProps = {
  history: ReturnType<typeof usePvpHistory>;
  loading: boolean;
  reviewBusy: boolean;
  onHistoryItemClick: (item: GameHistoryItem) => void;
};

function PvpGamesHistory({
  history,
  loading,
  reviewBusy,
  onHistoryItemClick,
}: PvpGamesHistoryProps) {
  return (
    <GamesHistory
      history={history.history}
      historyTotal={history.historyTotal}
      historyPage={history.historyPage}
      difficultyFilter={history.difficultyFilter}
      statusFilter={history.statusFilter}
      loading={loading}
      reviewBusy={reviewBusy}
      findCode={history.findCode}
      findBusy={history.findBusy}
      findError={history.findError}
      onDifficultyChange={history.changeDifficultyFilter}
      onStatusChange={history.changeStatusFilter}
      onPageChange={history.setHistoryPage}
      onHistoryItemClick={onHistoryItemClick}
      onFindCodeChange={history.setFindCode}
      onFindSubmit={() => void history.handleFindGame()}
    />
  );
}
