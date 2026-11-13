import type { GameReview, StatsPeriod, UserStats } from "@/api/types";
import { StatsMasthead } from "@/components/StatsMasthead";
import { useStatsMode, type StatsMode } from "@/hooks/useStatsMode";
import { PvpStatsBody } from "@/pages/PvpStatsBody";
import { SoloStatsBody } from "@/pages/SoloStatsBody";

type StatsPageProps = {
  stats: UserStats | null;
  period: StatsPeriod;
  loading: boolean;
  error: string | null;
  reconnecting?: boolean;
  onPeriodChange: (period: StatsPeriod) => void;
  onGoHome: () => void;
  onPlayDataReset: () => void;
  initialMode?: StatsMode;
  initialPartyId?: string | null;
  onPartyDetailClosed?: () => void;
  onOpenReview: (review: GameReview) => void;
};

export function StatsPage({
  stats,
  period,
  loading,
  error,
  reconnecting = false,
  onPeriodChange,
  onGoHome,
  onPlayDataReset,
  initialMode = "solo",
  initialPartyId = null,
  onPartyDetailClosed,
  onOpenReview,
}: StatsPageProps) {
  const statsMode = useStatsMode({ initialMode, initialPartyId, onPartyDetailClosed });

  return (
    <div className="gazette-home">
      <StatsMasthead
        mode={statsMode.mode}
        pvpMastheadTitle={statsMode.pvpMastheadTitle}
        onSelectMode={statsMode.selectMode}
        onGoHome={onGoHome}
      />
      {statsMode.mode === "solo" ? (
        <SoloStatsBody
          stats={stats}
          period={period}
          loading={loading}
          error={error}
          reconnecting={reconnecting}
          onPeriodChange={onPeriodChange}
          onPlayDataReset={onPlayDataReset}
        />
      ) : (
        <PvpStatsBody
          key={statsMode.pvpBodyKey}
          initialPartyId={statsMode.pvpSeedPartyId}
          onMastheadTitleChange={statsMode.setPvpMastheadTitle}
          onOpenReview={onOpenReview}
        />
      )}
    </div>
  );
}
