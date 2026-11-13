import { useState } from "react";

export type StatsMode = "solo" | "pvp";

type UseStatsModeArgs = {
  initialMode: StatsMode;
  initialPartyId: string | null;
  onPartyDetailClosed?: () => void;
};

// The screen can reopen Stats on a mode or a party; a new initial value resets the local choice.
export function useStatsMode({
  initialMode,
  initialPartyId,
  onPartyDetailClosed,
}: UseStatsModeArgs) {
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

  const selectMode = (nextMode: StatsMode) => {
    setPvpSeedPartyId(null);
    onPartyDetailClosed?.();
    if (nextMode === "pvp") {
      setPvpListEpoch((current) => current + 1);
    }
    setMode(nextMode);
  };

  return {
    mode,
    pvpBodyKey: `pvp-${pvpListEpoch}-${pvpSeedPartyId ?? "list"}`,
    pvpSeedPartyId,
    pvpMastheadTitle,
    setPvpMastheadTitle,
    selectMode,
  };
}
