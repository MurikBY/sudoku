import { useState } from "react";

import type { GameReview, StatsPeriod, UserStats } from "@/api/types";
import { PvpStatsBody } from "@/pages/PvpStatsBody";
import { SoloStatsBody } from "@/pages/SoloStatsBody";

export type StatsMode = "solo" | "pvp";

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
  const [mode, setMode] = useState<StatsMode>(initialMode);
  const [seenInitialMode, setSeenInitialMode] = useState(initialMode);
  if (initialMode !== seenInitialMode) {
    setSeenInitialMode(initialMode);
    setMode(initialMode);
  }
  const [pvpListEpoch, setPvpListEpoch] = useState(0);
  const [pvpSeedPartyId, setPvpSeedPartyId] = useState<string | null>(initialPartyId);
  const [seenInitialPartyId, setSeenInitialPartyId] = useState(initialPartyId);
  if (initialPartyId !== seenInitialPartyId) {
    setSeenInitialPartyId(initialPartyId);
    setPvpSeedPartyId(initialPartyId);
  }
  const [pvpMastheadTitle, setPvpMastheadTitle] = useState<string | null>(null);
  if (mode !== "pvp" && pvpMastheadTitle !== null) {
    setPvpMastheadTitle(null);
  }

  const openPvpList = () => {
    setPvpSeedPartyId(null);
    onPartyDetailClosed?.();
    setPvpListEpoch((current) => current + 1);
    setMode("pvp");
  };

  return (
    <div className="gazette-home">
      <header className="gazette-home-masthead gazette-stats-masthead">
        <div className="gazette-stats-masthead-row">
          <div className="gazette-stats-mode" role="tablist" aria-label="Statistics mode">
            {(
              [
                { value: "solo", label: "Stats" },
                { value: "pvp", label: "Games" },
              ] as const
            ).map((option, index) => {
              const isActive = mode === option.value;
              const separator = index > 0 ? ("dot" as const) : null;
              return (
                <span key={option.value} className="gazette-stats-period-item">
                  {separator === "dot" && (
                    <span className="gazette-stats-mode-sep-dot" aria-hidden="true">
                      ·
                    </span>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={
                      isActive
                        ? "gazette-stats-mode-tab gazette-stats-mode-tab-active"
                        : "gazette-stats-mode-tab"
                    }
                    onClick={() => {
                      if (option.value === "pvp") {
                        openPvpList();
                        return;
                      }
                      setMode(option.value);
                      setPvpSeedPartyId(null);
                      onPartyDetailClosed?.();
                    }}
                  >
                    {option.label}
                  </button>
                </span>
              );
            })}
          </div>
          <button type="button" onClick={onGoHome} className="gazette-stats-go-home">
            Go home
          </button>
        </div>
        {mode === "pvp" && pvpMastheadTitle && (
          <div className="gazette-stats-pvp-masthead-title-block">
            <div className="gazette-home-masthead-rule" aria-hidden="true" />
            <h2
              className={
                pvpMastheadTitle === "Games"
                  ? "gazette-stats-pvp-masthead-title gazette-stats-pvp-masthead-title-list"
                  : "gazette-stats-pvp-masthead-title"
              }
            >
              {pvpMastheadTitle}
            </h2>
          </div>
        )}
        <div className="gazette-home-masthead-rule" />
      </header>

      {mode === "solo" ? (
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
          key={`pvp-${pvpListEpoch}-${pvpSeedPartyId ?? "list"}`}
          initialPartyId={pvpSeedPartyId}
          onMastheadTitleChange={setPvpMastheadTitle}
          onOpenReview={onOpenReview}
        />
      )}
    </div>
  );
}
