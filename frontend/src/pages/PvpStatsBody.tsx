import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { fetchGameReview, fetchGameReviewByCode } from "@/api/games";
import type { GameHistoryItem, GameReview } from "@/api/types";
import { ErrorBanner } from "@/components/ErrorBanner";
import { GamesHistory } from "@/components/GamesHistory";
import { PartyResultsDetail } from "@/components/PartyResultsDetail";
import { usePartyResults } from "@/hooks/usePartyResults";
import { usePvpHistory } from "@/hooks/usePvpHistory";
import { formatApiErrorMessage } from "@/lib/api/apiError";
import { formatPartyLobbyName } from "@/lib/format/formatPartyLobbyName";

function abortPartyLoad(controllerRef: RefObject<AbortController | null>) {
  controllerRef.current?.abort();
}

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
  const [reviewBusy, setReviewBusy] = useState(false);
  const loadAbortRef = useRef<AbortController | null>(null);
  const { selectedPartyId, results, loadResults } = usePartyResults({
    initialPartyId,
    loadAbortRef,
    setLoading,
    setError,
    setReconnecting,
  });
  const {
    history: historyItems,
    historyTotal,
    historyPage,
    setHistoryPage,
    difficultyFilter,
    statusFilter,
    findCode,
    setFindCode,
    findBusy,
    findError,
    handleFindGame,
    changeDifficultyFilter,
    changeStatusFilter,
    loading: historyLoading,
    error: historyError,
    reconnecting: historyReconnecting,
  } = usePvpHistory({
    enabled: selectedPartyId === null,
    onOpenReview,
  });
  const bannerError = error ?? (selectedPartyId === null ? historyError : null);
  const bannerReconnecting =
    error !== null ? reconnecting : selectedPartyId === null && historyReconnecting;

  useEffect(() => {
    if (selectedPartyId && results && results.id === selectedPartyId) {
      onMastheadTitleChange(formatPartyLobbyName(results.code, results.started_at));
      return () => onMastheadTitleChange(null);
    }
    onMastheadTitleChange(null);
    return () => onMastheadTitleChange(null);
  }, [onMastheadTitleChange, results, selectedPartyId]);

  const openReviewByCode = useCallback(
    async (shareCode: string) => {
      setReviewBusy(true);
      setError(null);
      try {
        const review = await fetchGameReviewByCode(shareCode);
        onOpenReview(review);
      } catch (loadError) {
        setError(formatApiErrorMessage(loadError));
      } finally {
        setReviewBusy(false);
      }
    },
    [onOpenReview],
  );

  const openReviewForGame = useCallback(
    async (gameId: string) => {
      setReviewBusy(true);
      setError(null);
      try {
        const review = await fetchGameReview(gameId);
        onOpenReview(review);
      } catch (loadError) {
        setError(formatApiErrorMessage(loadError));
      } finally {
        setReviewBusy(false);
      }
    },
    [onOpenReview],
  );

  useEffect(() => {
    if (initialPartyId !== null) {
      void loadResults(initialPartyId);
    }
    return () => {
      abortPartyLoad(loadAbortRef);
    };
  }, [initialPartyId, loadResults]);

  const handleHistoryItemClick = (item: GameHistoryItem) => {
    if (item.is_party && item.party_id) {
      void loadResults(item.party_id);
      return;
    }
    void openReviewForGame(item.id);
  };

  if (selectedPartyId && loading && !results) {
    return (
      <>
        {bannerError && (
          <div className="px-4 pt-2">
            <ErrorBanner message={bannerError} reconnecting={bannerReconnecting} />
          </div>
        )}
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
        {bannerError && (
          <div className="px-4 pt-2">
            <ErrorBanner message={bannerError} reconnecting={bannerReconnecting} />
          </div>
        )}
        <PartyResultsDetail
          results={results}
          loading={loading}
          reviewBusy={reviewBusy}
          onReviewPlayer={(shareCode) => {
            void openReviewByCode(shareCode);
          }}
        />
      </>
    );
  }

  return (
    <>
      {bannerError && (
        <div className="px-4 pt-2">
          <ErrorBanner message={bannerError} reconnecting={bannerReconnecting} />
        </div>
      )}
      <GamesHistory
        history={historyItems}
        historyTotal={historyTotal}
        historyPage={historyPage}
        difficultyFilter={difficultyFilter}
        statusFilter={statusFilter}
        loading={historyLoading || loading}
        reviewBusy={reviewBusy}
        findCode={findCode}
        findBusy={findBusy}
        findError={findError}
        onDifficultyChange={changeDifficultyFilter}
        onStatusChange={changeStatusFilter}
        onPageChange={setHistoryPage}
        onHistoryItemClick={handleHistoryItemClick}
        onFindCodeChange={setFindCode}
        onFindSubmit={() => void handleFindGame()}
      />
    </>
  );
}
